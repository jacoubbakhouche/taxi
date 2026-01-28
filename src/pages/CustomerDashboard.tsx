import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import Map from "@/components/Map";
import DriverInfoCard from "@/components/DriverInfoCard";
import RatingDialog from "@/components/RatingDialog";
import CompleteProfileDialog from "@/components/CompleteProfileDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { BiddingControls } from "@/components/BiddingControls";
import { DriverOffersList } from "@/components/DriverOffersList";
import { MapPin, Navigation, LogOut, Search, User, ChevronDown, ChevronUp, Loader2, Menu, History, UserCircle, Settings } from "lucide-react";
import { playSound } from "@/utils/audio";
import { useTranslation } from "react-i18next";

/**
 * CustomerDashboard - Rebuilt for stability
 * 
 * Key Features:
 * 1. Database-first State Restoration: Checks DB immediately on load.
 * 2. Robust Realtime Updates: Single subscription for ride status.
 * 3. Clean UI Layering: Header always on top.
 * 4. Simplified Logic: Clear separation of phases (Idle -> Searching -> Pending -> Accepted -> In Progress -> Completed).
 */

const CustomerDashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // --- Core State ---
  const [userId, setUserId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true); // Initial loading state

  // --- Ride State ---
  const [rideStatus, setRideStatus] = useState<"idle" | "searching" | "pending" | "accepted" | "in_progress" | "completed">("idle");
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<any[]>([]);

  // --- Ride Details ---
  const [searchQuery, setSearchQuery] = useState("");
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [price, setPrice] = useState(0);
  const [estimatedPrice, setEstimatedPrice] = useState(0); // For Hybrid Logic
  const [isPriceModified, setIsPriceModified] = useState(false); // Robust Hybrid Flag
  const [pickupAddress, setPickupAddress] = useState(""); // UI State

  // --- Driver State ---
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
  const [candidateDriver, setCandidateDriver] = useState<any>(null);
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [declinedDrivers, setDeclinedDrivers] = useState<string[]>([]);



  // --- UI State ---
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [rejectedDriverIds, setRejectedDriverIds] = useState<string[]>([]);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);

  // ===========================================
  // 1. Initialization & Restoration
  // ===========================================
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);

        // 1. Check Session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/customer/auth");
          return;
        }

        // 2. Get User DB ID & Profile
        // Fetch full fields to check completeness
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', session.user.id)
          .single();

        if (!user) {
          throw new Error("User record not found");
        }
        setUserId(user.id);

        // Check for missing info
        if (!user.phone || !user.full_name) {
          setShowCompleteProfile(true);
        }

        // 3. Location is now handled by the dedicated useEffect with fallback below


        // 4. Restore Active Ride (CRITICAL FIX)
        const { data: activeRide, error: rideError } = await supabase
          .from('rides')
          .select('*')
          .eq('customer_id', user.id)
          .in('status', ['pending', 'accepted', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeRide) {
          console.log("Found active ride:", activeRide);
          setCurrentRideId(activeRide.id);
          setRideStatus(activeRide.status as any);

          // Restore map data
          if (
            activeRide.destination_lat != null &&
            activeRide.destination_lng != null
          ) {
            setDestination([activeRide.destination_lat, activeRide.destination_lng]);
            setSearchQuery(activeRide.destination_address || "الوجهة");
            // Priority: Final Deal > Customer Offer > Original Estimate
            setPrice(activeRide.final_price || activeRide.customer_offer_price || activeRide.price);
            setDistance(activeRide.distance);
            setDuration(activeRide.duration);

            if (
              activeRide.pickup_lat != null &&
              activeRide.pickup_lng != null
            ) {
              // 1. Set simple start/end first (fallback)
              const pickup = [activeRide.pickup_lat, activeRide.pickup_lng] as [number, number];
              const dest = [activeRide.destination_lat, activeRide.destination_lng] as [number, number];
              setRoute([pickup, dest]);

              // 2. Fetch Detailed Route Implementation
              // We need to re-fetch the route geometry so it follows the road
              fetch(`https://router.project-osrm.org/route/v1/driving/${pickup[1]},${pickup[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`)
                .then(res => res.json())
                .then(data => {
                  if (data.code === 'Ok' && data.routes?.[0]) {
                    const geometry = data.routes[0].geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]);
                    setRoute(geometry);
                  }
                })
                .catch(err => console.error("Failed to restore detailed route:", err));
            }
          }

          // Restore driver if exists
          if (activeRide.driver_id) {
            await fetchDriverDetails(activeRide.driver_id);
          }
        }

      } catch (error) {
        console.error("Initialization failed:", error);
        toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []); // Run ONCE on mount

  // NEW: Dedicated Location Watcher with Fallback Strategy
  useEffect(() => {
    let watchId: number;

    const startWatching = (highAccuracy = true) => {
      if (!navigator.geolocation) return;

      // 1. Initial Quick Fix
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
        (err) => {
          console.warn(`Initial location error (HighAccuracy: ${highAccuracy}):`, err);
          if (highAccuracy) {
            // Fallback to low accuracy
            console.log("Falling back to low accuracy...");
            startWatching(false);
          }
        },
        { enableHighAccuracy: highAccuracy, maximumAge: highAccuracy ? 0 : 60000, timeout: 10000 }
      );

      // 2. Continuous Watch
      if (watchId) navigator.geolocation.clearWatch(watchId);

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => console.error("Watch error:", err),
        { enableHighAccuracy: highAccuracy, maximumAge: 0, timeout: 20000 }
      );
    };

    startWatching(true);

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // ===========================================
  // 2. Realtime Subscriptions
  // ===========================================
  useEffect(() => {
    if (!currentRideId) return;

    console.log(`Subscribing to ride: ${currentRideId}`);

    const channel = supabase
      .channel(`ride-${currentRideId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${currentRideId}`,
        },
        async (payload) => {
          const updatedRide = payload.new;
          console.log("Ride update received:", updatedRide);

          if (updatedRide.status === 'accepted') {
            setRideStatus('accepted');
            if (updatedRide.final_price) setPrice(updatedRide.final_price); // Update price from DB
            if (updatedRide.driver_id) fetchDriverDetails(updatedRide.driver_id);
            playSound('notification');
            toast({ title: "تم قبول الطلب! 🚕", description: "السائق قادم إليك" });
          }
          else if (updatedRide.status === 'in_progress') {
            setRideStatus('in_progress');
            toast({ title: "بدأت الرحلة 🚀", description: "نتمنى لك رحلة سعيدة" });
          }
          else if (updatedRide.status === 'completed') {
            setRideStatus('completed');
            setShowRating(true);
          }
          else if (updatedRide.status === 'cancelled') {
            resetState();
            toast({ title: "تم إلغاء الرحلة ❌", description: "نعتذر، تم إلغاء الرحلة.", variant: "destructive" });
          }
        }
      )
      .subscribe();

    return () => {
      console.log("Unsubscribing from ride");
      supabase.removeChannel(channel);
    };
  }, [currentRideId]);

  // Phantom Cars Polling
  useEffect(() => {
    // STRICT RULE: Only show cars when a destination/pickup point is selected
    // If no destination is set, show NOTHING (clean map)
    const center = destination;

    if (!center) {
      setNearbyDrivers([]); // Clear existing cars
      return;
    }

    const fetchDrivers = async () => {
      const { data } = await supabase.rpc('get_nearby_drivers', {
        p_lat: center[0],
        p_lng: center[1],
        p_radius_meters: 5000 // Keep 5km radius
      });

      if (data) {
        setNearbyDrivers(data.map((d: any) => ({
          position: [d.lat, d.lng],
          rotation: d.heading,
          icon: 'car',
          popup: "سائق متاح"
        })));
      }
    };

    fetchDrivers(); // Initial fetch
    const interval = setInterval(fetchDrivers, 10000); // Poll every 10s

    return () => clearInterval(interval);
  }, [destination]); // Only re-run when destination changes

  // Driver Location Subscription
  useEffect(() => {
    if (!driverInfo?.id || (rideStatus !== 'accepted' && rideStatus !== 'in_progress')) return;

    const channel = supabase
      .channel(`driver-loc-${driverInfo.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${driverInfo.id}`,
        },
        (payload) => {
          const d = payload.new;
          if (
            d.current_lat != null &&
            d.current_lng != null
          ) {
            setDriverLocation([d.current_lat, d.current_lng]);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [driverInfo?.id, rideStatus]);

  // ===========================================
  // 3. Helper Functions
  // ===========================================
  const getPlaceName = async (lat: number, lng: number): Promise<string> => {
    try {
      // Using BigDataCloud free client API which is CORS friendly
      const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ar`);
      const data = await res.json();

      const city = data.city || data.locality || "";
      const principalSubdivision = data.principalSubdivision || "";
      const countryName = data.countryName || "";

      // Format: "City, Province"
      const parts = [city, principalSubdivision].filter(p => p && p !== "");

      if (parts.length > 0) return parts.join(", ");
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
      console.error("Geocoding failed", error);
      return "موقع محدد";
    }
  };

  const fetchDriverDetails = async (driverId: string) => {
    const { data: driver } = await supabase.from('users').select('*').eq('id', driverId).single();
    if (driver) {
      const { count } = await supabase.from('rides').select('*', { count: 'exact', head: true }).eq('driver_id', driverId).eq('status', 'completed');
      setDriverInfo({ ...driver, total_rides: count || 0 });

      if (driver.current_lat != null && driver.current_lng != null) {
        setDriverLocation([driver.current_lat, driver.current_lng]);
      }
    }
  };



  const resetState = () => {
    setCurrentRideId(null);
    setRideStatus('idle');
    setDestination(null);
    setRoute([]);
    setSearchQuery("");
    setDriverInfo(null);
    setCandidateDriver(null);
    setIsSearchingDriver(false);
    setRejectedDriverIds([]); // Crucial to allow finding skipped drivers again in new ride
    localStorage.removeItem('currentRideId');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // ===========================================
  // 4. Action Handlers
  // ===========================================
  const handleMapClick = async (lat: number, lng: number) => {
    if (rideStatus === 'idle') {
      setDestination([lat, lng]);
      setSearchQuery("جاري تحديد العنوان..."); // Temporary loading text
      const address = await getPlaceName(lat, lng);
      setSearchQuery(address);
    }
  };

  const calculateRoute = async () => {
    if (!userLocation || !destination) return;

    // Simple Math (Haversine mostly) would go here, 
    // but reusing the simple one for speed
    const R = 6371;
    const dLat = (destination[0] - userLocation[0]) * Math.PI / 180;
    const dLon = (destination[1] - userLocation[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(userLocation[0] * Math.PI / 180) * Math.cos(destination[0] * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km

    setDistance(d);
    setDuration((d / 40) * 60); // 40km/h avg
    const calcPrice = 100 + (d * 50);
    setPrice(calcPrice); // 100 base + 50 per km
    setEstimatedPrice(calcPrice); // Store original for comparison
    setIsPriceModified(false); // Reset to Standard Mode
    setRoute([userLocation, destination]);

    // Fetch pickup address for UI
    const pAddr = await getPlaceName(userLocation[0], userLocation[1]);
    setPickupAddress(pAddr);
  };

  useEffect(() => {
    if (destination && userLocation && rideStatus === 'idle') calculateRoute();
  }, [destination]);

  // Function to search drivers, accepting an explicit exclude list to bypass state batching delay
  const findNearestDriver = async (explicitExcludeList: string[] | null = null) => {
    setIsSearchingDriver(true);
    setCandidateDriver(null);

    // Valid exclusion list: either the passed explicit one (priority) or the current state
    const exclusionList = explicitExcludeList || rejectedDriverIds;

    try {
      if (!userLocation) {
        toast({ title: "خطأ", description: "لم يتم تحديد موقعك الحالي", variant: "destructive" });
        setIsSearchingDriver(false);
        return;
      }

      console.log("Searching for drivers near:", userLocation);
      console.log("Excluding drivers:", exclusionList);

      // Call the Server-Side Matcher (PostGIS)
      // This is much faster and scalable than fetching all users
      const { data: drivers, error } = await supabase.rpc('match_drivers_for_ride', {
        client_lat: userLocation[0],
        client_long: userLocation[1],
        radius_km: 10,  // 10km Radius
        limit_count: 5,  // Get top 5
        excluded_driver_ids: exclusionList // Pass the blacklist
      });

      if (error) throw error;

      console.log("Matched Drivers (RPC):", drivers);

      if (!drivers || drivers.length === 0) {
        toast({ title: "لا يوجد سائقين", description: "لا يوجد سائقين متاحين حالياً في منطقتك (10 كم)", variant: "destructive" });
        setIsSearchingDriver(false);
        return;
      }

      // Convert RPC result to compatible driver object for UI
      // Use the first one (Closest)
      const closest = drivers[0];

      // Need to transform it to match 'user' table shape for candiateDriver state
      // (Or fetch full profile if needed, but RPC returns enough basic info)
      // We will create a hybrid object or just use the ID to fetch full profile if logic requires it.
      // But let's check what 'setCandidateDriver' expects. It expects a User object.
      // For now, let's construct a minimal object or fetch full profile.
      // Fetching full profile for the candidate is safer for UI rendering.

      const { data: fullProfile } = await supabase.from('users').select('*').eq('id', closest.driver_id).single();

      if (fullProfile) {
        // Fetch REAL total rides count from the rides table
        // 1. Fetch REAL total rides count from the rides table
        const { count: realRideCount } = await supabase
          .from('rides')
          .select('*', { count: 'exact', head: true })
          .eq('driver_id', fullProfile.id)
          .eq('status', 'completed');

        // 2. Fetch REAL average rating from reviews table
        // We can't use .avg() directly in simple client SDK on foreign table easily without RPC, 
        // but we can fetch all ratings and average them (assuming reasonable count < 1000 for client side or use RPC for scale).
        // For scalability, an RPC 'get_driver_stats' is better, but here we do client-side for immediate fix as requested.
        const { data: reviews } = await supabase
          .from('reviews')
          .select('rating')
          .eq('reviewee_id', fullProfile.id);

        let calculatedRating = 5.0;
        if (reviews && reviews.length > 0) {
          const total = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
          calculatedRating = total / reviews.length;
        }

        setCandidateDriver({
          ...fullProfile,
          total_rides: realRideCount || 0,
          rating: calculatedRating // OVERRIDE user.rating with calculated one
        });
      } else {
        // Fallback if fetch fails (rare)
        toast({ title: "Error", description: "Driver data error", variant: "destructive" });
      }

    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Search failed", variant: "destructive" });
    } finally {
      setIsSearchingDriver(false);
    }
  };

  /* 
     Update handleRequestRide: 
     If new request, we should start fresh? 
     Actually if candidateDriver is NULL, we call findNearestDriver.
     If we want to start a FRESH search session, we should clear rejected list.
  */
  const handleRequestRide = async () => {
    if (!userId || !destination) return;

    // HYBRID LOGIC: Robust Check
    const isBidding = isPriceModified;

    // 1. Standard Ride Flow: First find a candidate
    if (!isBidding && !candidateDriver) {
      findNearestDriver([]);
      return;
    }

    try {
      // 2. Insert Ride
      // If candidate exists (Standard), target them.
      // If Bidding, target no one (Open).
      const insertPayload = {
        customer_id: userId,
        driver_id: candidateDriver ? candidateDriver.id : null,
        pickup_lat: userLocation![0],
        pickup_lng: userLocation![1],
        destination_lat: destination[0],
        destination_lng: destination[1],
        pickup_address: await getPlaceName(userLocation![0], userLocation![1]),
        destination_address: searchQuery,
        price: price,
        customer_offer_price: price,
        is_bidding: isBidding,
        distance: distance,
        duration: duration,
        status: 'pending'
      };

      const { data, error } = await supabase.from('rides').insert(insertPayload).select().single();

      if (error) throw error;

      setCurrentRideId(data.id);
      setRideStatus('pending');

      // If Bidding, we clear candidate to show Offers List
      // If Standard, we KEEP candidate to show "Waiting for Ahmed..."
      if (isBidding) {
        setCandidateDriver(null);
        toast({ title: "تم نشر الطلب", description: "بانتظار عروض السائقين..." });
      } else {
        toast({ title: "تم إرسال الطلب", description: `بانتظار قبول ${candidateDriver.full_name}...` });
      }

    } catch (e) {
      console.error(e);
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleCancelRide = async () => {
    if (!currentRideId) return;
    await supabase.from('rides').update({ status: 'cancelled' }).eq('id', currentRideId);
    resetState();
    setRejectedDriverIds([]); // Clear history
  };

  const handleEndRide = async () => {
    if (!currentRideId) return;
    try {
      const { error } = await supabase.from('rides').update({ status: 'completed' }).eq('id', currentRideId);
      if (error) throw error;
      setRideStatus('completed');
      setShowRating(true);
    } catch (e) {
      console.error("Failed to end ride", e);
      toast({ title: "Error", description: "Failed to end ride. Ensure you have permission.", variant: "destructive" });
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=dz&limit=1`);
      const data = await res.json();
      if (data?.[0]) {
        setDestination([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        toast({ title: "Found", description: data[0].display_name });
      } else {
        toast({ title: "Not Found", variant: "destructive" });
      }
    } catch (e) { console.error(e); }
  };

  const handleRatingSubmit = async (rating: number) => {
    if (currentRideId && driverInfo) {
      await supabase.from('reviews').insert({
        ride_id: currentRideId,
        reviewer_id: userId,
        reviewee_id: driverInfo.id,
        rating,
        comment: "Customer Review"
      });

      // Update Aggregates (Simplified)
      // ideally db trigger does this

      toast({ title: "شكراً لك", description: "تم تقييم السائق" });
    }
    resetState();
    setShowRating(false);
  };

  // ===========================================
  // 5. Render
  // ===========================================
  const getMarkers = () => {
    const markers: any[] = []; // Initialize empty array

    // 1. My Location
    if (userLocation) markers.push({ position: userLocation, icon: "🧍", popup: "أنا" });

    // 2. Destination
    if (destination) markers.push({ position: destination, icon: "📍", popup: "الوجهة" });

    // 3. Assigned Driver (The Real One)
    if (driverLocation && (rideStatus === 'accepted' || rideStatus === 'in_progress')) {
      markers.push({
        position: driverLocation,
        icon: "🚗",
        popup: `السائق: ${driverInfo?.full_name || "قادم إليك"}`,
        // We could add rotation if available in driverInfo
      });
    }

    // 4. Phantom Cars (Only when IDLE or SEARCHING) -> "Lighter Map" when busy
    if (rideStatus === 'idle' || rideStatus === 'searching' || rideStatus === 'pending') {
      markers.push(...nearbyDrivers);
    }

    return markers;
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="h-screen flex flex-col bg-background relative overflow-hidden">
      {/* --- Header (Z-Index Fixed) --- */}
      {/* --- Header (Z-Index Fixed) --- */}
      <header className="absolute top-0 left-0 right-0 z-[3000] p-4 flex justify-between items-start">
        {/* Logo Box */}
        <div className="bg-card/90 backdrop-blur border border-border rounded-full p-2 pr-4 pl-2 flex items-center gap-3 shadow-lg">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <MapPin className="text-black w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm">Taxi DZ</h1>
          </div>
        </div>

        {/* Actions */}
        {/* Actions - REPLACED WITH SIDEBAR */}
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="secondary" className="rounded-full shadow-lg h-12 w-12 bg-[#1A1A1A] text-white border border-white/10 hover:bg-white/10">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-[#1A1A1A] border-l border-white/10 text-white w-[300px] sm:w-[400px]">
            <SheetHeader className="mb-8 text-right">
              <SheetTitle className="text-2xl font-bold text-white mb-2">{t('common.menu')}</SheetTitle>
              <div className="h-1 w-20 bg-[#84cc16] rounded-full ml-auto"></div>
            </SheetHeader>

            <div className="flex flex-col gap-4">
              <Button
                variant="ghost"
                className="justify-start gap-4 h-14 text-lg hover:bg-white/5 hover:text-[#84cc16] transition-colors"
                onClick={() => navigate("/customer/profile")}
              >
                <UserCircle className="w-6 h-6" />
                {t('sidebar.profile')}
              </Button>

              <Button
                variant="ghost"
                className="justify-start gap-4 h-14 text-lg hover:bg-white/5 hover:text-[#84cc16] transition-colors"
                onClick={() => navigate("/customer/history")}
              >
                <History className="w-6 h-6" />
                {t('sidebar.history')}
              </Button>

              <div className="h-px bg-white/10 my-4"></div>

              <Button
                variant="ghost"
                className="justify-start gap-4 h-14 text-lg hover:bg-white/5 hover:text-[#84cc16] transition-colors"
                onClick={() => navigate("/settings")}
              >
                <Settings className="w-6 h-6" />
                {t('sidebar.settings')}
              </Button>

              <div className="h-px bg-white/10 my-4"></div>

              <div className="px-2 text-xs text-gray-500 font-medium font-mono text-center opacity-50">
                {t('sidebar.version')} 1.0.0
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* --- Map Layer --- */}
      < div className="absolute inset-0 z-0" >
        <Map
          center={userLocation || [36.75, 3.05]}
          markers={getMarkers()}
          route={route}
          onMapClick={handleMapClick}
        />
      </div >

      {candidateDriver && !currentRideId && (
        <div className="absolute font-sans bottom-0 left-0 right-0 p-4 bg-[#111] border-t border-white/10 rounded-t-3xl animate-in slide-in-from-bottom-10 z-[3000]">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-green-500">
              {candidateDriver.profile_image ? (
                <img src={candidateDriver.profile_image} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white font-bold text-lg">
                  {candidateDriver.full_name?.[0]}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">{candidateDriver.full_name}</h3>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1 bg-[#84cc16]/10 px-2 py-0.5 rounded-full">
                  <span className="text-[#84cc16] text-xs font-bold">★ {candidateDriver.rating?.toFixed(1) || 5.0}</span>
                </div>
                <div className="text-gray-400 text-xs flex items-center gap-1">
                  <span className="font-mono text-white/50">|</span>
                  <span>{candidateDriver.total_rides || 0} رحلة</span>
                  <span className="font-mono text-white/50">|</span>
                  <span>{candidateDriver.car_model || "Taxi"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {/* REJECT BUTTON - The logic fix */}
            <Button
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white h-12 rounded-xl font-bold border border-white/10"
              onClick={() => {
                // 1. Calculate new list IMMEDIATELY
                const newList = [...rejectedDriverIds, candidateDriver.id];
                // 2. Update UI State (for future)
                setRejectedDriverIds(newList);
                // 3. Search AGAIN using the NEW list directly (Bypassing state delay)
                findNearestDriver(newList);
              }}
            >
              رفض
            </Button>

            <Button
              className="flex-[2] bg-[#84cc16] hover:bg-[#65a30d] text-black h-12 rounded-xl font-bold"
              onClick={handleRequestRide}
            >
              قبول
            </Button>
          </div>
        </div>
      )}

      {/* --- Auction / Pending State --- */}
      {
        rideStatus === 'pending' && currentRideId && !candidateDriver && (
          <DriverOffersList
            rideId={currentRideId}
            currentPrice={price}
            pickupAddress={pickupAddress || "موقعي الحالي"}
            destinationAddress={searchQuery || "الوجهة"}
            onAcceptOffer={async (offerId) => {
              try {
                const { error } = await supabase.rpc('accept_ride_offer', { p_offer_id: offerId });
                if (error) throw error;
                setRideStatus('accepted');
                toast({ title: "تم قبول العرض! 🎉", description: "السائق قادم إليك" });
              } catch (e) {
                toast({ title: "فشل قبول العرض", variant: "destructive" });
              }
            }}
            onCancelRide={handleCancelRide}
            onUpdatePrice={async (newPrice) => {
              setPrice(newPrice);
              await supabase.from('rides').update({ price: newPrice, customer_offer_price: newPrice }).eq('id', currentRideId);
            }}
          />
        )
      }

      {/* --- Standard Ride "Waiting" State --- */}
      {
        rideStatus === 'pending' && currentRideId && candidateDriver && (
          <div className="fixed bottom-0 left-0 right-0 z-[1000] p-6 bg-[#1A1A1A] text-white rounded-t-3xl border-t border-white/10 animate-in slide-in-from-bottom-10">
            <div className="flex flex-col items-center py-6 gap-4">
              <Loader2 className="w-12 h-12 text-[#84cc16] animate-spin" />
              <div className="text-center">
                <h3 className="text-xl font-bold mb-1">بانتظار قبول السائق...</h3>
                <p className="text-gray-400">لقد أرسلنا طلبك إلى {candidateDriver.full_name}</p>
              </div>
              <Button variant="outline" className="w-full mt-2 border-red-500/20 text-red-500 hover:bg-red-500/10" onClick={handleCancelRide}>
                إلغاء الطلب
              </Button>
            </div>
          </div>
        )
      }

      {/* --- Pre-Order Sheet (Bidding) --- */}
      {
        rideStatus === 'idle' && !candidateDriver && (
          <div className="fixed bottom-0 left-0 right-0 z-[1000] p-6 pb-8 bg-[#1A1A1A] text-white rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.7)] border-t border-white/5 transition-all duration-300 animate-in slide-in-from-bottom-10">
            {/* Handle Bar */}
            <div className="w-full flex justify-center pb-5">
              <div className="w-12 h-1.5 bg-gray-700 rounded-full opacity-50"></div>
            </div>

            {!destination ? (
              <div className="flex gap-3">
                <Input
                  placeholder="أين تريد الذهاب؟"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="text-right bg-white/5 border-white/10 text-white placeholder:text-gray-500 rounded-xl h-12"
                  dir="rtl"
                />
                <Button size="icon" className="h-12 w-12 rounded-xl bg-[#84cc16] text-black hover:bg-[#84cc16]/90" onClick={handleSearch}>
                  <Search className="w-5 h-5" />
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center text-right" dir="rtl">
                  <div className="flex-1 pl-4">
                    {/* BIDDING CONTROLS */}
                    <BiddingControls
                      estimatedPrice={price}
                      onPriceChange={(newPrice) => {
                        setPrice(newPrice);
                        // Only mark as modified if it actually differs from estimate
                        // (or just assume user interaction = modification)
                        if (Math.abs(newPrice - estimatedPrice) > 1) {
                          setIsPriceModified(true);
                        } else {
                          // If user puts it back to original, maybe go back to standard?
                          // Yes, let's allow going back.
                          setIsPriceModified(false);
                        }
                      }}
                    />
                  </div>

                  <Button variant="ghost" size="sm" className="text-[#84cc16] hover:text-[#84cc16]/80 hover:bg-white/5 shrink-0" onClick={() => { setDestination(null); setRoute([]); setSearchQuery(""); }}>
                    تغيير الوجهة
                  </Button>
                </div>

                <div className="bg-white/5 p-4 rounded-2xl flex items-center gap-3 border border-white/5">
                  <div className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center border border-white/10">
                    <MapPin className="text-[#84cc16]" />
                  </div>
                  <div className="text-right flex-1">
                    <p className="text-xs text-gray-500">الوجهة</p>
                    <p className="font-bold text-sm truncate">{searchQuery}</p>
                    <div className="flex text-xs text-gray-400 gap-2 mt-1">
                      <span>{distance.toFixed(1)} كم</span>
                      <span>•</span>
                      <span>{duration.toFixed(0)} دقيقة</span>
                    </div>
                  </div>
                </div>

                <Button className="w-full text-lg font-bold py-7 rounded-xl bg-[#84cc16] text-black hover:bg-[#84cc16]/90 shadow-lg shadow-[#84cc16]/10" onClick={handleRequestRide}>
                  {isSearchingDriver ? <Loader2 className="animate-spin mr-2" /> : `بحث عن سائق (${Math.round(price)} دج)`}
                </Button>
              </div>
            )}
          </div>
        )
      }

      {/* --- Candidate Driver Popup (Legacy Flow / Or if matched by system) --- */}
      {/* Keeping this as fallback or if instant matchmaking is preferred alongside bidding later */}

      {/* --- Pending State (Radar Effect) - REPLACED BY DriverOffersList above if pure bidding --- */}
      {/* But let's keep the radar effect BEHIND the list maybe? Or just hide it. The list acts as the view. */}
      {/* We removing the duplicate pending view block to avoid overlap */}

      {/* --- Radar Animation Layer (Optional Background for Pending) --- */}
      {
        rideStatus === 'pending' && !candidateDriver && (
          // Minimal loader or nothing. The DriverOffersList covers the screen.
          null
        )
      }


      {/* --- Radar Animation Layer --- */}
      {
        isSearchingDriver && (
          <div className="absolute inset-0 z-[2000] bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in">
            <div className="relative flex items-center justify-center w-64 h-64">
              <div className="w-20 h-20 bg-[#1A1A1A] border-2 border-[#84cc16] rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(132,204,22,0.4)] z-10 relative">
                <Loader2 className="w-10 h-10 text-[#84cc16] animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full border border-[#84cc16] animate-ping opacity-20"></div>
              <div className="absolute inset-4 rounded-full border border-[#84cc16] animate-ping opacity-20 delay-150"></div>
              <div className="absolute inset-8 rounded-full border border-[#84cc16] animate-ping opacity-20 delay-300"></div>
            </div>

            <div className="space-y-4 text-center z-10 mt-8">
              <h2 className="text-3xl font-bold text-white tracking-tight">جاري البحث عن كابتن...</h2>
              <p className="text-gray-400 text-sm">نقوم بالبحث عن أقرب سائق متاح لك</p>

              <Button
                variant="outline"
                className="mt-6 border-white/20 text-white hover:bg-white/10 px-8 py-6 rounded-full"
                onClick={() => setIsSearchingDriver(false)}
              >
                إلغاء البحث
              </Button>
            </div>
          </div>
        )
      }

      {/* --- Active Ride (Accepted/In Progress) --- */}
      {
        (rideStatus === 'accepted' || rideStatus === 'in_progress') && driverInfo && (
          <DriverInfoCard
            driver={driverInfo}
            rideStatus={rideStatus}
            price={price}
            rideId={currentRideId || undefined}
            onCancel={handleCancelRide}
            onEndRide={handleEndRide}
          />
        )
      }

      {/* --- Rating Dialog --- */}
      <RatingDialog
        open={showRating}
        onOpenChange={(open) => {
          setShowRating(open);
          if (!open && rideStatus === 'completed') {
            resetState(); // Force reset if user closes dialog without rating
          }
        }}
        onSubmit={handleRatingSubmit}
        name={driverInfo?.full_name || "السائق"}
        role="driver"
      />
      <CompleteProfileDialog
        open={showCompleteProfile}
        userId={userId || ""}
        onComplete={() => setShowCompleteProfile(false)}
      />
    </div >
  );
};

export default CustomerDashboard;
