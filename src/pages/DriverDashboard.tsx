
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import Map from "@/components/Map";
import RideRequestCard from "@/components/RideRequestCard";
import RatingDialog from "@/components/RatingDialog";
import { Car, Navigation, LogOut, Power, CheckCircle, Clock, MapPin, User, Loader2, Phone, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const DriverDashboard = () => {
  const navigate = useNavigate();
  // Initialize to null, but we will render map anyway with a fallback center
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
  const [driverHeading, setDriverHeading] = useState(0);
  const [isOnline, setIsOnline] = useState(false);
  const [pendingRide, setPendingRide] = useState<any>(null);
  const [currentRide, setCurrentRide] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [customerLocation, setCustomerLocation] = useState<[number, number] | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<[number, number] | null>(null);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);
  const [ignoredRideIds, setIgnoredRideIds] = useState<string[]>([]);
  const [locationKey, setLocationKey] = useState(0);

  const [isVerified, setIsVerified] = useState<boolean>(true); // Handle verification
  const [documentsSubmitted, setDocumentsSubmitted] = useState<boolean>(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [carteGriseFile, setCarteGriseFile] = useState<File | null>(null);
  const [isSubscriptionExpired, setIsSubscriptionExpired] = useState(false); // New State for Subscription

  // ... (inside checkAuth) update this state


  useEffect(() => {
    checkAuth();
    // Try to recover location from DB first (for instant map load)
    const recoverLocation = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const { data } = await supabase.from('users').select('current_lat, current_lng').eq('auth_id', session.user.id).single();
        if (data?.current_lat && data?.current_lng) {
          console.log("Recovered location from DB:", data.current_lat, data.current_lng);
          setDriverLocation([data.current_lat, data.current_lng]);
        }
      }
    };
    recoverLocation();

    getCurrentLocation(); // Then try fresh GPS
  }, []);

  // ... (rest of restoring active ride)

  // ...

  useEffect(() => {
    if (!isOnline || !userId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    console.log("Starting GPS Watch...");
    getCurrentLocation(); // Try single-shot immediately to trigger fallback logic if watch hangs

    // Force High Accuracy
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const newLocation: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];

        console.log("GPS Fix:", newLocation);
        setDriverLocation(newLocation);
        setDriverHeading(position.coords.heading || 0);

        // Force map re-center on first fix
        if (!driverLocation) {
          setLocationKey(prev => prev + 1);
        }

        // Use RPC to update driver location (PostGIS)
        const { error: locationError } = await supabase
          .rpc('update_driver_location', {
            p_lat: newLocation[0],
            p_lng: newLocation[1],
            p_heading: position.coords.heading || 0
          });

        if (locationError) {
          console.error("Error updating location:", locationError);
        }

        // التحقق من وصول السائق للعميل أوتوماتيكياً
        if (currentRide && currentRide.status === 'accepted' && customerLocation) {
          const distanceToCustomer = calculateDistance(
            newLocation[0],
            newLocation[1],
            customerLocation[0],
            customerLocation[1]
          );

          // إذا كان السائق على بعد أقل من 50 متر من العميل
          if (distanceToCustomer < 0.05) {
            await supabase
              .from('rides')
              .update({ status: 'in_progress' })
              .eq('id', currentRide.id);

            setCurrentRide({ ...currentRide, status: 'in_progress' });

            toast({
              title: "بدأت الرحلة! 🚗",
              description: "أنت الآن في الطريق إلى الوجهة",
            });
          }
        }
      },
      (error) => {
        console.warn('GPS Watch Error:', error);
        // Do not block ui, just warn
        if (error.code === 1) toast({ title: "GPS Permission Denied", description: "Allow location access.", variant: "destructive" });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 } // Match CustomerDashboard strictness
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isOnline, userId, currentRide, customerLocation]);

  // 3. NEW: Check for EXISTING pending AND active rides on mount/resume
  useEffect(() => {
    if (!isOnline || !userId || !driverLocation) return;

    // A. Check for Active Rides (Accepted / In Progress) - RECOVERY LOGIC
    const fetchActiveRide = async () => {
      const { data: activeRide } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', userId)
        .in('status', ['accepted', 'in_progress'])
        .maybeSingle();

      if (activeRide) {
        console.log("Found ACTIVE ride on resume:", activeRide);
        setCurrentRide(activeRide);

        // Fetch customer info for this active ride
        if (activeRide.customer_id) {
          const { data: customerData } = await supabase
            .from('users')
            .select('id, full_name, phone, rating, total_rides, profile_image')
            .eq('id', activeRide.customer_id)
            .single();

          if (customerData) {
            setCustomerInfo(customerData);
            setCustomerLocation([activeRide.pickup_lat, activeRide.pickup_lng]);
            setDestinationLocation([activeRide.destination_lat, activeRide.destination_lng]);
          }
        }
        setIsSheetExpanded(true);
        return; // Exit if we found an active ride, no need to look for pending
      }

      // B. If no active ride, look for Pending Rides
      const fetchPendingRides = async () => {
        console.log("Checking for existing pending rides...");
        const { data: rides, error } = await supabase
          .from('rides')
          .select('*')
          .eq('status', 'pending')
          .or(`driver_id.is.null,driver_id.eq.${userId}`);

        if (error) {
          console.error('Error fetching pending rides:', error);
          return;
        }

        // Filter out ignored rides
        const validRides = rides.filter(r => !ignoredRideIds.includes(r.id));

        if (validRides && validRides.length > 0) {
          // Find the closest ride
          let closestRide = null;
          let minDistance = Infinity;

          for (const ride of validRides) {
            const distance = calculateDistance(
              driverLocation[0],
              driverLocation[1],
              ride.pickup_lat,
              ride.pickup_lng
            );

            if (distance <= 5 && distance < minDistance) {
              minDistance = distance;
              closestRide = ride;
            }
          }

          if (closestRide) {
            console.log("Found existing pending ride:", closestRide);
            setPendingRide(closestRide);

            // Fetch customer info
            const { data: customerData } = await supabase
              .from('users')
              .select('id, full_name, phone, rating, total_rides, profile_image')
              .eq('id', closestRide.customer_id)
              .single();

            if (customerData) {
              setCustomerInfo(customerData);
            }
            setIsSheetExpanded(true);
          }
        }
      };

      fetchPendingRides();
    };

    fetchActiveRide();

  }, [isOnline, userId, driverLocation, ignoredRideIds]); // Removed pendingRide/currentRide to strictly run on state/location availability

  const checkAuth = async () => {
    try {
      // ... (existing auth check init) ...
      const { data: { session } } = await supabase.auth.getSession();

      // ... (existing user fetch) ...
      let user = null;
      const result = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', session.user.id)
        .maybeSingle();


      // 0. FETCH GLOBAL SETTINGS
      const { data: settings } = await supabase
        .from('app_settings')
        .select('premium_mode_enabled')
        .maybeSingle();

      const isPremiumMode = settings?.premium_mode_enabled ?? false; // Default to Free if not set? Or True? Let's assume False (Freemium) if missing to be safe, or True.
      // Let's assume the migration created a row. If not, maybe default to what matches the business goal. I'll default to 'false' (Freemium) as fallback.

      if (!result.error && result.data) {
        user = result.data;
        setUserId(user.id);
      }

      if (!user) {
        console.error("User profile not found");
        return;
      }

      // 0.5 CHECK SUSPENSION (Always Enforced)
      if (user.is_suspended) {
        console.log("User is SUSPENDED -> Blocking access");
        setIsSubscriptionExpired(true); // Re-use the red screen
        return;
      }

      // FREEMIUM LOGIC BRANCH
      if (!isPremiumMode) {
        console.log("FREEMIUM MODE ACTIVE: Skipping Verification & Sub Checks");
        // In Freemium, we allow access even if not verified or sub is null.
        // We might still want to prompt for docs, but NOT BLOCK.
        // However, the prompt says "allow access regardless".
        // So we set valid flags.
        setIsVerified(true);
        setIsSubscriptionExpired(false);
        setIsOnline(user.is_online || false);
        return;
      }

      // === PREMIUM MODE (Strict Checks) ===

      // 1. CHECK DOCUMENTS / VERIFICATION
      if (!user.is_verified) {
        console.log("User not verified (Premium Mode) - Blocking access");

        // Special Case: Blocked/Suspended User 
        // If they submitted docs effectively (or were previously verified) AND have ANY subscription date set (even if valid),
        // it means they are an EXISTING driver who was Suspended by Admin.
        // Show Red Screen (Contact Admin) instead of Yellow (Under Review).
        const subEnd = user.subscription_end_date ? new Date(user.subscription_end_date) : null;

        if (user.documents_submitted && subEnd) {
          console.log("User unverified BUT has subscription date (Suspended) -> Show Red Screen");
          setIsSubscriptionExpired(true);
          return;
        }

        setIsVerified(false);
        // @ts-ignore
        setDocumentsSubmitted(user.documents_submitted || false);
        return;
      }

      // 2. CHECK SUBSCRIPTION
      const now = new Date();
      const subEnd = user.subscription_end_date ? new Date(user.subscription_end_date) : null;

      if (!subEnd || subEnd < now) {
        console.log("Subscription expired:", user.subscription_end_date);
        setIsSubscriptionExpired(true);
        // We do NOT set isVerified=false here, because we want to show a DIFFERENT screen (Subscription Expired), 
        // not the Upload Documents screen.
        // Returning here prevents entering the dashboard.
        return;
      }

      setIsSubscriptionExpired(false);
      setIsVerified(true);
      setIsOnline(user.is_online || false);
    } catch (error) {
      // ...
    }
  };



  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };



  function getCurrentLocation() {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported");
      return;
    }

    // Match CustomerDashboard logic: Accurate, Fresh, NO custom timeout blocking
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDriverLocation([position.coords.latitude, position.coords.longitude]);
        setLocationKey(prev => prev + 1);
      },
      (error) => {
        console.error("Error getting location:", error);
        // Silent fail or minimal log, don't block user with toast
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  const handleUploadDocuments = async () => {
    if (!licenseFile || !carteGriseFile || !userId) {
      toast({
        title: "Missing Documents",
        description: "Please select both Driving License and Carte Grise images.",
        variant: "destructive",
      });
      return;
    }

    setUploadingFiles(true);
    try {
      // Helper to upload file
      const uploadFile = async (file: File, path: string) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${path}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('driver_documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('driver_documents')
          .getPublicUrl(fileName);

        return publicUrl;
      };

      const licenseUrl = await uploadFile(licenseFile, 'license');
      const carteGriseUrl = await uploadFile(carteGriseFile, 'carte_grise');

      console.log("Files uploaded successfully. License:", licenseUrl, "Card:", carteGriseUrl);
      console.log("Attempting to update user profile...");

      // Update User Profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          driving_license_url: licenseUrl,
          carte_grise_url: carteGriseUrl,
          documents_submitted: true
        })
        .eq('id', userId);

      if (updateError) {
        console.error("Database Update Error:", updateError);
        throw updateError;
      }

      setDocumentsSubmitted(true);
      toast({
        title: "Documents Sent! 📄✅",
        description: "Your account is now under review. Please wait for approval.",
      });

    } catch (error: any) {
      console.error("Upload/Update Failed Full Error:", error);
      alert(`Upload Failed: ${error.message || JSON.stringify(error)}`); // Aggressive alert as requested
      toast({
        title: "Upload Failed",
        description: error.message || "Could not upload documents.",
        variant: "destructive",
      });
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const toggleOnline = async () => {
    if (!userId) {
      console.error("toggleOnline: userId is missing!");
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.log("Found session, attempting to refetch user...");
        // Quick fetch to recover
        const { data: userData } = await supabase.from('users').select('id, is_verified').eq('auth_id', data.session.user.id).single();
        if (userData) {
          console.log("Recovered userId:", userData.id);
          setUserId(userData.id);
          // Now proceed with update? No, let user click again or recursive call?
          // Let's just return nicely with a prompt.
          toast({ title: "تم تحديث البيانات", description: "يرجى المحاولة مجدداً الآن." });
          return;
        }
      }

      toast({
        title: "خطأ في الاتصال",
        description: "لا يمكن تحديد معرف السائق. يرجى تحديث الصفحة.",
        variant: "destructive",
      });
      return;
    }

    const newStatus = !isOnline;
    // Optimistic UI update
    setIsOnline(newStatus);
    setLoading(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_online: newStatus })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: newStatus ? "أصبحت متاحاً ✅" : "أصبحت غير متاح",
        description: newStatus ? "ستبدأ باستقبال طلبات الرحلات" : "لن تتلقى طلبات جديدة",
        className: "bg-primary text-primary-foreground border-none",
      });
    } catch (error: any) {
      console.error('Error updating online status:', error);
      setIsOnline(!newStatus); // Revert
      toast({
        title: "فشل الاتصال",
        description: error.message || "حدث خطأ أثناء تحديث الحالة. تأكد من اتصالك بالإنترنت.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Listener for when Customer accepts the offer
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('my-rides-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `driver_id=eq.${userId}`,
        },
        async (payload) => {
          const updatedRide = payload.new;
          if (updatedRide.status === 'accepted') {
            console.log("Offer accepted!", updatedRide);
            setCurrentRide(updatedRide);

            // Fetch customer info
            if (updatedRide.customer_id) {
              const { data: customerData } = await supabase
                .from('users')
                .select('id, full_name, phone, rating, total_rides, profile_image')
                .eq('id', updatedRide.customer_id)
                .single();

              if (customerData) {
                setCustomerInfo(customerData);
                setCustomerLocation([updatedRide.pickup_lat, updatedRide.pickup_lng]);
                setDestinationLocation([updatedRide.destination_lat, updatedRide.destination_lng]);
              }
            }

            toast({
              title: "تم قبول عرضك! 🎉",
              description: "العميل في انتظارك، ابدأ الرحلة",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleInstantAccept = async () => {
    if (!pendingRide || !userId) return;

    try {
      setLoading(true);

      // Direct update to accept the ride
      const { error } = await supabase
        .from('rides')
        .update({
          status: 'accepted',
          driver_id: userId,
          offered_price: pendingRide.price // Set the agreed price
        })
        .eq('id', pendingRide.id);

      if (error) throw error;

      // Optimistic update
      setCurrentRide({ ...pendingRide, status: 'accepted', driver_id: userId, offered_price: pendingRide.price });
      setPendingRide(null);

      // Fetch customer info
      if (pendingRide.customer_id) {
        const { data: customerData } = await supabase
          .from('users')
          .select('id, full_name, phone, rating, total_rides, profile_image')
          .eq('id', pendingRide.customer_id)
          .single();

        if (customerData) {
          setCustomerInfo(customerData);
          setCustomerLocation([pendingRide.pickup_lat, pendingRide.pickup_lng]);
          setDestinationLocation([pendingRide.destination_lat, pendingRide.destination_lng]);
        }
      }

      toast({
        title: "تم قبول الرحلة! ✅",
        description: "توجه إلى موقع العميل",
      });
    } catch (error: any) {
      console.error('Error accepting ride:', error);
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء قبول الرحلة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRide = async (price: number) => {
    if (!pendingRide || !userId) return;

    try {
      setLoading(true);

      // Direct updates to rides table (Simplification)
      const { error } = await supabase
        .from('rides')
        .update({
          status: 'accepted',
          driver_id: userId,
          final_price: price
        })
        .eq('id', pendingRide.id);

      if (error) throw error;

      // Update local state
      setCurrentRide({
        ...pendingRide,
        status: 'accepted',
        driver_id: userId,
        final_price: price
      });

      // Set locations for the map to render
      setCustomerLocation([pendingRide.pickup_lat, pendingRide.pickup_lng]);
      setDestinationLocation([pendingRide.destination_lat, pendingRide.destination_lng]);

      // Do NOT clear customerInfo - we need it for the accepted ride UI!
      // setCustomerInfo(null); 

      setPendingRide(null);
      setIsSheetExpanded(false);

      toast({
        title: "تم قبول الرحلة! ✅",
        description: "توجه إلى موقع العميل",
      });
    } catch (error: any) {
      console.error('Error accepting ride:', error);
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء قبول الرحلة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };



  const handleRejectRide = async () => {
    if (!pendingRide) return;

    // Local ignore only - do NOT delete from DB so other drivers can see it
    setIgnoredRideIds(prev => [...prev, pendingRide.id]);

    setPendingRide(null);
    setCustomerInfo(null);
    setIsSheetExpanded(false);

    toast({
      title: "تم تجاهل الطلب",
      description: "لن يظهر لك هذا الطلب مرة أخرى",
    });
  };

  const handleCustomerClick = () => {
    if (customerInfo) {
      navigate(`/driver/customer/${customerInfo.id}`);
    }
  };

  const [showRating, setShowRating] = useState(false);

  const handleCompleteRide = async () => {
    if (!currentRide) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from('rides')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', currentRide.id);

      if (error) throw error;

      localStorage.removeItem('activeRideId');

      toast({
        title: "تمت الرحلة بنجاح! 🎉",
        description: "يرجى تقييم العميل",
      });

      // Delay cleaning content to show rating
      setShowRating(true);

    } catch (error) {
      console.error('Error completing ride:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من إنهاء الرحلة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRatingSubmit = async (rating: number) => {
    if (!currentRide || !customerInfo) return;

    try {
      // 1. Insert review
      await supabase.from('reviews').insert({
        ride_id: currentRide.id,
        reviewer_id: userId,
        reviewee_id: currentRide.customer_id,
        rating: rating,
        comment: "Rated by driver"
      });

      // 2. Update user aggregate rating
      const newRating = ((customerInfo.rating * customerInfo.total_rides) + rating) / (customerInfo.total_rides + 1);

      await supabase.from('users').update({
        rating: newRating,
        total_rides: customerInfo.total_rides + 1
      }).eq('id', customerInfo.id);

      toast({
        title: "تم إرسال التقييم",
        description: "شكراً لك!",
      });

    } catch (e) {
      console.error(e);
    } finally {
      setShowRating(false);
      setCurrentRide(null);
      setCustomerLocation(null);
      setDestinationLocation(null);
      setCustomerInfo(null);
    }
  };

  const getMarkers = () => {
    const markers: Array<{ position: [number, number]; popup?: string; icon?: string }> = [];

    markers.push({
      position: driverLocation,
      popup: "موقعي الحالي",
      icon: "🚗"
    });

    // Pending Ride Markers
    if (pendingRide) {
      markers.push({
        position: [pendingRide.pickup_lat, pendingRide.pickup_lng],
        popup: "موقع العميل (Pickup) 📍",
        icon: "🧍"
      });
      markers.push({
        position: [pendingRide.destination_lat, pendingRide.destination_lng],
        popup: "الوجهة (Dropoff) 🎯",
        icon: "pin"
      });
    }

    if (customerLocation && currentRide?.status === 'accepted') {
      markers.push({
        position: customerLocation,
        popup: "موقع العميل 📍",
        icon: "🧍"
      });
      // Show destination marker in accepted state too
      if (destinationLocation) {
        markers.push({
          position: destinationLocation,
          popup: "الوجهة (Dropoff) 🎯",
          icon: "pin"
        });
      }
    }

    if (currentRide?.status === 'in_progress') {
      if (customerLocation) {
        markers.push({
          position: customerLocation,
          popup: "نقطة الانطلاق 📍",
          icon: "🧍"
        });
      }
      if (destinationLocation) {
        markers.push({
          position: destinationLocation,
          popup: "الوجهة 🎯",
          icon: "📍"
        });
      }
    }

    return markers;
  };

  const getRoute = (): [number, number][] | undefined => {
    if (pendingRide) {
      // Driver -> Pickup -> Destination
      return [
        driverLocation,
        [pendingRide.pickup_lat, pendingRide.pickup_lng] as [number, number],
        [pendingRide.destination_lat, pendingRide.destination_lng] as [number, number]
      ];
    }

    if (!currentRide) return undefined;

    if (currentRide.status === 'accepted' && customerLocation) {
      // Driver -> Pickup -> Destination
      if (destinationLocation) {
        return [driverLocation, customerLocation, destinationLocation];
      }
      return [driverLocation, customerLocation];
    }

    if (currentRide.status === 'in_progress' && customerLocation && destinationLocation) {
      return [driverLocation, destinationLocation];
    }

    return undefined;
  };

  // 0. BLOCKER: SUBSCRIPTION EXPIRED / ACCOUNT SUSPENDED
  if (isSubscriptionExpired) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-8 space-y-8 font-sans animate-in fade-in">
        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center animate-pulse">
          <Clock className="w-12 h-12 text-red-500" />
        </div>

        <div className="text-center space-y-4 max-w-sm">
          <h1 className="text-3xl font-bold text-red-500">تنبيه حساب</h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            حسابك معلق حالياً أو انتهى اشتراكك.
            <br />
            يرجى التواصل مع الإدارة لتسوية الوضعية.
          </p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <Button
            className="w-full bg-[#84cc16] hover:bg-[#65a30d] text-black font-bold h-14 text-lg rounded-xl shadow-lg shadow-lime-500/20"
            onClick={() => window.open('tel:0555555555')}
          >
            <Phone className="w-5 h-5 mr-3" />
            اتصل بالإدارة
          </Button>

          <Button variant="ghost" onClick={handleLogout} className="w-full text-gray-500 hover:text-white">
            تسجيل الخروج
          </Button>
        </div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 space-y-6 font-sans">
        <div className="w-20 h-20 bg-yellow-400/10 rounded-full flex items-center justify-center animate-pulse">
          <ShieldCheck className="w-10 h-10 text-yellow-400" />
        </div>

        <div className="text-center space-y-2 max-w-md">
          <h1 className="text-2xl font-bold">Verification Required</h1>
          <p className="text-gray-400">
            {documentsSubmitted
              ? "Your documents have been received and are under review. Please wait for admin approval."
              : "To start driving, please upload your driving license and registration card."}
          </p>
        </div>

        {documentsSubmitted ? (
          <div className="bg-[#1A1A1A] p-6 rounded-xl border border-white/10 w-full max-w-sm text-center shadow-2xl">
            <Clock className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Under Review</h3>
            <p className="text-sm text-gray-500 mb-6">This usually takes 1-24 hours</p>
            <Button variant="outline" className="w-full border-[#333] hover:bg-[#222] text-white" onClick={() => window.location.reload()}>
              Check Status
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="w-full mt-2 text-xs text-gray-600 hover:text-red-500">
              Logout
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-4 bg-[#1A1A1A] p-6 rounded-xl border border-white/10 shadow-2xl">
            {/* Driving License Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Driving License (Permis)</label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="license-upload"
                  onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="license-upload"
                  className={cn(
                    "flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors backdrop-blur-sm",
                    licenseFile ? "border-[#84cc16] bg-[#84cc16]/10" : "border-gray-700 hover:border-gray-500 hover:bg-gray-800"
                  )}
                >
                  {licenseFile ? (
                    <div className="text-center">
                      <CheckCircle className="w-8 h-8 text-[#84cc16] mx-auto mb-2" />
                      <span className="text-xs text-[#84cc16] font-bold">{licenseFile.name}</span>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      <div className="w-10 h-10 border border-current rounded-lg mx-auto mb-2 flex items-center justify-center text-[10px] opacity-50">IMG</div>
                      <span className="text-xs font-medium">Tap to upload License</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Carte Grise Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Vehicle Registration (Carte Grise)</label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="cg-upload"
                  onChange={(e) => setCarteGriseFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="cg-upload"
                  className={cn(
                    "flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors backdrop-blur-sm",
                    carteGriseFile ? "border-[#84cc16] bg-[#84cc16]/10" : "border-gray-700 hover:border-gray-500 hover:bg-gray-800"
                  )}
                >
                  {carteGriseFile ? (
                    <div className="text-center">
                      <CheckCircle className="w-8 h-8 text-[#84cc16] mx-auto mb-2" />
                      <span className="text-xs text-[#84cc16] font-bold">{carteGriseFile.name}</span>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      <div className="w-10 h-10 border border-current rounded-lg mx-auto mb-2 flex items-center justify-center text-[10px] opacity-50">IMG</div>
                      <span className="text-xs font-medium">Tap to upload Card</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <Button
              className="w-full bg-[#84cc16] hover:bg-[#65a30d] text-black font-bold h-12 text-lg shadow-lg shadow-lime-500/20 mt-2"
              onClick={handleUploadDocuments}
              disabled={uploadingFiles}
            >
              {uploadingFiles ? <Loader2 className="animate-spin mr-2" /> : "Submit Documents"}
            </Button>

            <Button variant="ghost" onClick={handleLogout} className="w-full text-xs text-gray-600 hover:text-red-500">
              Logout
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background relative overflow-hidden">
      {/* --- Professional Header (Same as Customer) --- */}
      <header className="absolute top-0 left-0 right-0 z-[3000] p-4 flex justify-between items-start">
        {/* Logo/Status Box */}
        <div className="bg-card/90 backdrop-blur border border-border rounded-full p-2 pr-4 pl-2 flex items-center gap-3 shadow-lg">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
            isOnline ? "bg-green-500" : "bg-red-500"
          )}>
            <Car className="text-black w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm">Taxi DZ</h1>
            <p className="text-[10px] text-muted-foreground font-medium">
              {isOnline ? "You are Online" : "You are Offline"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {/* Online Toggle */}
          <Button
            size="icon"
            onClick={toggleOnline}
            className={cn(
              "rounded-full w-10 h-10 transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md",
              isOnline
                ? "bg-black/60 text-[#84cc16] hover:bg-black/70 shadow-[0_0_15px_rgba(132,204,22,0.3)]"
                : "bg-black/60 text-red-500 hover:bg-black/70"
            )}
          >
            <Power className="w-5 h-5 fill-current" />
          </Button>

          {/* Profile */}
          <Button
            size="icon"
            onClick={() => navigate('/driver/profile')}
            className="rounded-full w-10 h-10 bg-black/60 backdrop-blur-md border border-white/10 text-white hover:bg-black/70 shadow-lg"
          >
            <User className="w-5 h-5" />
          </Button>

          {/* Logout */}
          <Button
            size="icon"
            onClick={handleLogout}
            className="rounded-full w-10 h-10 bg-black/60 backdrop-blur-md border border-white/10 text-red-500 hover:bg-black/70 shadow-lg hover:text-red-400"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* --- Map Layer --- */}
      <div className="absolute inset-0 z-0">
        <Map
          center={driverLocation || [36.7538, 3.0588]} // Default to Algiers if waiting for GPS
          recenterKey={locationKey}
          markers={[
            ...(driverLocation ? [{
              position: driverLocation,
              popup: "موقعي الحالي",
              icon: "🚗",
              rotation: driverHeading
            }] : []),
            ...(pendingRide ? [
              { position: [pendingRide.pickup_lat, pendingRide.pickup_lng], popup: "موقع العميل (Pickup) 📍", icon: "🧍" },
              { position: [pendingRide.destination_lat, pendingRide.destination_lng], popup: "الوجهة (Dropoff) 🎯", icon: "pin" }
            ] as any[] : []),
            ...(customerLocation && currentRide?.status === 'accepted' ? [
              { position: customerLocation, popup: "موقع العميل 📍", icon: "🧍" },
              ...(destinationLocation ? [{ position: destinationLocation, popup: "الوجهة (Dropoff) 🎯", icon: "pin" }] : [])
            ] as any[] : []),
            ...(currentRide?.status === 'in_progress' ? [
              ...(customerLocation ? [{ position: customerLocation, popup: "نقطة الانطلاق 📍", icon: "🧍" }] : []),
              ...(destinationLocation ? [{ position: destinationLocation, popup: "الوجهة 🎯", icon: "📍" }] : [])
            ] as any[] : [])
          ]}
          // If we have a destination (active ride), show route
          route={
            customerLocation && destinationLocation
              ? [customerLocation, destinationLocation]
              : undefined
          }
          onMapClick={() => { }}
        />

      </div>

      {/* --- Overlay: Offline State --- */}
      {!isOnline && (
        <div className="absolute inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
          <div className="bg-[#1A1A1A] p-8 rounded-3xl border border-white/10 text-center space-y-4 shadow-2xl">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Power className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold">You are Offline</h2>
            <p className="text-gray-400 max-w-xs">You are not receiving ride requests. Go online to start working.</p>
            <Button size="lg" className="w-full bg-green-500 hover:bg-green-600 text-black font-bold rounded-xl" onClick={toggleOnline}>
              GO ONLINE
            </Button>
          </div>
        </div>
      )}

      {/* --- Ride Request Card (Pending) --- */}
      {pendingRide && isSheetExpanded && (
        <RideRequestCard
          ride={pendingRide}
          customer={customerInfo}
          distance={1.0} // Ideally passed
          onAccept={handleAcceptRide}
          onReject={handleRejectRide}
        />
      )}

      {/* --- Active Ride Info (Accepted/In Progress) --- */}
      {/* --- Active Ride Info (Accepted/In Progress) --- */}
      {/* --- Active Ride Info (Accepted/In Progress) --- */}
      {currentRide && !showRating && (
        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 z-[2000] bg-[#1A1A1A] rounded-t-[2rem] border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-in-out",
            isSheetExpanded ? "translate-y-0" : "translate-y-[calc(100%-120px)]"
          )}
        >
          {/* Handle Bar (Toggle) */}
          <div
            className="w-full flex justify-center pt-4 pb-2 cursor-pointer"
            onClick={() => setIsSheetExpanded(!isSheetExpanded)}
          >
            <div className="h-1.5 w-12 bg-gray-700 rounded-full opacity-50"></div>
          </div>

          <div className="p-6 pt-2">

            {/* Trip Progress (Moved to Top) */}
            <div className="mb-6">
              {(() => {
                // Dynamic Calculation Logic
                let targetLat = 0, targetLng = 0;
                let totalDist = 0;
                let mode = ""; // 'pickup' or 'dropoff'

                if (currentRide.status === 'accepted') {
                  targetLat = currentRide.pickup_lat;
                  targetLng = currentRide.pickup_lng;
                  mode = "pickup";
                  // Estimate initial distance if known, else assume max 5km for bar scale? 
                  // Ideally we'd have initial_distance in DB. 
                  totalDist = 5; // Default reference for bar
                } else if (currentRide.status === 'in_progress') {
                  targetLat = currentRide.destination_lat;
                  targetLng = currentRide.destination_lng;
                  mode = "dropoff";
                  totalDist = currentRide.distance || 10;
                }

                // Haversine Distance
                const R = 6371; // km
                const dLat = (targetLat - driverLocation[0]) * Math.PI / 180;
                const dLon = (targetLng - driverLocation[1]) * Math.PI / 180;
                const a =
                  Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(driverLocation[0] * Math.PI / 180) * Math.cos(targetLat * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distKm = R * c;

                // Estimate Time (Assume 30km/h inside city)
                const speedKmh = 30;
                const timeHours = distKm / speedKmh;
                const timeMin = Math.ceil(timeHours * 60);

                // Progress Bar
                // For pickup: calculate inverse progress (getting closer). 
                // We'll just show 'remaining' concept. Visual bar represents completion.
                // If distKm > totalDist, we are far (0% progress). If distKm is 0, we are there.
                // Progress = 1 - (current / starting). But we don't have starting live.
                // Simpler: Bar shows proximity. 
                // Let's use a "Reverse Progress" for the slider.
                // if we define progress as % of Journey Completed.
                // This is hard without start point. But for 'in_progress' we have total trip distance.

                let progressPercent = 0;
                if (mode === 'dropoff' && totalDist > 0) {
                  progressPercent = Math.max(0, Math.min(100, ((totalDist - distKm) / totalDist) * 100));
                } else {
                  // For pickup, maybe just show indeterminate or 50%?
                  // Or let's just base it on distance: closer = more green. 
                  // Say max pickup range is 3km.
                  // progressPercent = (1 - (distKm / 3)) * 100
                  progressPercent = Math.max(10, Math.min(95, (1 - (distKm / 5)) * 100));
                }

                // Format Arrival Time
                const arrivalTime = new Date(Date.now() + timeMin * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <>
                    <div className="flex justify-between items-center mb-2 px-1">
                      <div>
                        <span className="text-2xl font-bold text-white">{distKm.toFixed(1)}</span> <span className="text-xs text-gray-500">km</span>
                      </div>
                      <div className="text-gray-600">•</div>
                      <div>
                        <span className="text-2xl font-bold text-white">{timeMin}</span> <span className="text-xs text-gray-500">min</span>
                      </div>
                    </div>
                    <div className="relative h-2 bg-gray-800 rounded-full mx-1">
                      <div
                        className="absolute top-0 left-0 bottom-0 bg-[#84cc16] rounded-full shadow-[0_0_10px_#84cc16] transition-all duration-1000"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-[#84cc16] transition-all duration-1000"
                        style={{ left: `${progressPercent}%` }}
                      >
                        <Navigation className="w-3 h-3 text-[#84cc16] fill-current transform rotate-45" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 px-1">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-bold text-white">{arrivalTime}</span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider ml-1">ESTIMATED ARRIVAL</span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Header (Status) */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                    currentRide.status === 'in_progress' ? "bg-blue-500 text-white" : "bg-lime-500 text-black"
                  )}>
                    {currentRide.status === 'in_progress' ? "IN TRIP" : "ACCEPTED"}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white">
                  {currentRide.status === 'in_progress' ? "Heading to Destination" : "Picking up Customer"}
                </h2>
              </div>
              {/* Actions (Phone Button) */}
              <div className="flex gap-2">
                <Button size="icon" variant="secondary" className="rounded-full bg-[#84cc16] text-black hover:bg-[#65a30d]" onClick={() => window.location.href = `tel:${customerInfo?.phone}`}>
                  <Phone className="w-5 h-5 fill-current" />
                </Button>
              </div>
            </div>

            {/* Customer Info */}
            <div className="flex items-center gap-4 mb-6 bg-white/5 p-4 rounded-2xl border border-white/5" onClick={handleCustomerClick}>
              <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden border-2 border-white/10">
                {customerInfo?.profile_image ? (
                  <img src={customerInfo.profile_image} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl font-bold">{customerInfo?.full_name?.[0]}</div>
                )}
              </div>
              <div>
                <h3 className="font-bold text-white">{customerInfo?.full_name || "Customer"}</h3>
                <div className="flex items-center gap-1 text-xs text-lime-500">
                  <span>★</span> {customerInfo?.rating?.toFixed(1) || "5.0"} ({customerInfo?.total_rides || 0} rides)
                </div>
              </div>
              <div className="flex-1 text-right">
                <p className="text-xl font-bold text-white">{currentRide.final_price || currentRide.price} DA</p>
                <p className="text-xs text-gray-500">CASH</p>
              </div>
            </div>

            {/* Complete Button */}
            <Button
              size="lg"
              className="w-full h-14 text-lg font-bold rounded-xl bg-[#84cc16] text-black hover:bg-[#84cc16]/90 shadow-lg shadow-lime-500/10"
              onClick={handleCompleteRide}
            >
              <CheckCircle className="mr-2 w-6 h-6" /> COMPLETE RIDE
            </Button>
          </div>
        </div>
      )}

      {/* Rating Dialog */}
      <RatingDialog
        open={showRating}
        onOpenChange={setShowRating}
        onSubmit={handleRatingSubmit}
        name={customerInfo?.full_name || "العميل"}
        role="customer"
      />
    </div>
  );
};

export default DriverDashboard;
