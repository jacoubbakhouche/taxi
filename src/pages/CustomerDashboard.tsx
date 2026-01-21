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
import { MapPin, Navigation, LogOut, Search, User, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const [userLocation, setUserLocation] = useState<[number, number]>([36.7372, 3.0865]); // Algiers default
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [candidateDriver, setCandidateDriver] = useState<any>(null); // For pre-approval
  const [declinedDrivers, setDeclinedDrivers] = useState<string[]>([]); // To avoid re-showing declined drivers
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [rideStatus, setRideStatus] = useState<string>("idle");
  const [showRating, setShowRating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);

  // استعادة حالة الرحلة من localStorage عند التحميل
  useEffect(() => {
    const restoreRideState = async () => {
      const savedRideId = localStorage.getItem('currentRideId');
      if (savedRideId) {
        const { data: ride, error } = await supabase
          .from('rides')
          .select('*')
          .eq('id', savedRideId)
          .single();

        if (ride && !error) {
          // الرحلة لا تزال نشطة
          if (['pending', 'accepted', 'in_progress'].includes(ride.status)) {
            setCurrentRideId(ride.id);
            setRideStatus(ride.status);
            setDestination([ride.destination_lat, ride.destination_lng]);
            setUserLocation([ride.pickup_lat, ride.pickup_lng]);
            setPrice(ride.price || 0);
            setDistance(ride.distance || 0);
            setDuration(ride.duration || 0);
            setSearchQuery(ride.destination_address || 'الوجهة المحددة');
            setRoute([[ride.pickup_lat, ride.pickup_lng], [ride.destination_lat, ride.destination_lng]]);

            // استعادة معلومات السائق إذا كانت الرحلة مقبولة
            if (ride.driver_id && (ride.status === 'accepted' || ride.status === 'in_progress')) {
              const { data: driver } = await supabase
                .from('users')
                .select('*')
                .eq('id', ride.driver_id)
                .single();

              if (driver) {
                setDriverInfo(driver);
                setDriverLocation([driver.current_lat, driver.current_lng]);
              }
            }
          } else {
            // الرحلة انتهت، مسح البيانات المحفوظة
            localStorage.removeItem('currentRideId');
          }
        } else {
          localStorage.removeItem('currentRideId');
        }
      }
    };

    checkAuth();
    getCurrentLocation();
    restoreRideState();
  }, []);

  useEffect(() => {
    if (destination && userLocation && rideStatus === 'idle') {
      calculateRoute(userLocation, destination);
    }
  }, [destination]);

  useEffect(() => {
    if (!currentRideId) return;

    const handleRideUpdate = async (ride: any) => {
      console.log('Processing Ride Update:', ride);

      if (ride.status === 'accepted') {
        // Updated logic: Trust status 'accepted' even if driver_id check needs verification
        if (rideStatus !== 'accepted') {
          setRideStatus('accepted');
          toast({
            title: "تم قبول الطلب! 🎉",
            description: "السائق في الطريق إليك",
          });
        }

        const dId = ride.driver_id;
        if (dId) {
          if (!driverInfo || driverInfo.id !== dId) {
            const { data: driver } = await supabase
              .from('users')
              .select('*')
              .eq('id', dId)
              .single();

            if (driver) {
              setDriverInfo(driver);
              setDriverLocation([driver.current_lat, driver.current_lng]);
            }
          }
        } else {
          console.warn('Accepted ride missing driver_id, refetching...');
          const { data: refetchedRide } = await supabase.from('rides').select('*').eq('id', ride.id).single();
          if (refetchedRide && refetchedRide.driver_id) {
            const { data: driver } = await supabase
              .from('users')
              .select('*')
              .eq('id', refetchedRide.driver_id)
              .single();
            if (driver) {
              setDriverInfo(driver);
              setDriverLocation([driver.current_lat, driver.current_lng]);
            }
          }
        }
      } else if (ride.status === 'in_progress') {
        setRideStatus('in_progress');
        toast({
          title: "الرحلة بدأت! 🚗",
          description: "أنت الآن في الطريق إلى وجهتك",
        });
      } else if (ride.status === 'completed') {
        setRideStatus('completed');
        setShowRating(true);
      } else if (ride.status === 'cancelled') {
        setRideStatus('idle');
        setDriverInfo(null);
        setCurrentRideId(null);
        localStorage.removeItem('currentRideId');
        toast({
          title: "تم إلغاء الرحلة",
          description: "نعتذر، لغى السائق الرحلة.",
          variant: "destructive"
        });
      }
    };

    // Realtime subscription
    const channel = supabase
      .channel('ride-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${currentRideId}`,
        },
        async (payload) => {
          const ride = payload.new;
          console.log('Ride updated (Realtime):', ride);
          handleRideUpdate(ride);
        }
      )
      .subscribe();

    // Polling fallback (every 3 seconds)
    const intervalId = setInterval(async () => {
      if (rideStatus === 'pending' || rideStatus === 'accepted') {
        console.log('Polling ride:', currentRideId);
        const { data: ride, error } = await supabase
          .from('rides')
          .select('*')
          .eq('id', currentRideId)
          .single();

        console.log('Polling result:', { ride, error });

        if (error) {
          console.error('Polling error:', error);
        }

        if (ride && !error) {
          if (ride.status !== rideStatus || (ride.status === 'accepted' && !driverInfo)) {
            console.log('Ride updated (Polling):', ride);
            handleRideUpdate(ride);
          }
        }
      }
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, [currentRideId, rideStatus, driverInfo]);

  // Use refs to track state for cleanup
  const rideIdRef = useRef<string | null>(null);
  const statusRef = useRef<string>('idle');

  useEffect(() => {
    rideIdRef.current = currentRideId;
    statusRef.current = rideStatus;
  }, [currentRideId, rideStatus]);

  // Cleanup on unmount: Cancel pending ride if user leaves dashboard
  useEffect(() => {
    return () => {
      const rId = rideIdRef.current;
      const st = statusRef.current;

      if (rId && st === 'pending') {
        console.log("Auto-cancelling pending ride on exit...");
        supabase.from('rides').update({ status: 'cancelled' }).eq('id', rId).then(() => {
          console.log("Ride cancelled successfully");
        });
      }
    };
  }, []);

  // تتبع موقع السائق في الوقت الفعلي
  useEffect(() => {
    if (!driverInfo?.id || (rideStatus !== 'accepted' && rideStatus !== 'in_progress')) return;

    const channel = supabase
      .channel('driver-location-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${driverInfo.id}`,
        },
        (payload) => {
          const driver = payload.new;
          if (driver.current_lat && driver.current_lng) {
            setDriverLocation([driver.current_lat, driver.current_lng]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverInfo?.id, rideStatus]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/customer/auth");
      return;
    }

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (user) {
      setUserId(user.id);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Error getting location:", error);
          toast({
            title: "تنبيه",
            description: "لم نتمكن من تحديد موقعك الحالي",
            variant: "destructive",
          });
        }
      );
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const navigateToProfile = () => {
    navigate("/customer/profile");
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (rideStatus === 'idle') {
      setDestination([lat, lng]);
      setSearchQuery("الوجهة المحددة");
    }
  };

  const calculatePrice = (distanceKm: number) => {
    const BASE_PRICE = 100;
    const PRICE_PER_KM = 50;
    return BASE_PRICE + (distanceKm * PRICE_PER_KM);
  };

  // حساب المسافة باستخدام معادلة Haversine
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // نصف قطر الأرض بالكيلومتر
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateRoute = async (pickup: [number, number], dest: [number, number]) => {
    setCalculatingRoute(true);
    try {
      // حساب المسافة المباشرة
      const distanceKm = calculateDistance(pickup[0], pickup[1], dest[0], dest[1]);
      const durationMin = (distanceKm / 40) * 60; // بافتراض متوسط سرعة 40 كم/ساعة
      const calculatedPrice = calculatePrice(distanceKm);

      // إنشاء خط مستقيم بين النقطتين
      const straightLine: [number, number][] = [pickup, dest];

      setRoute(straightLine);
      setDistance(distanceKm);
      setDuration(durationMin);
      setPrice(calculatedPrice);

      toast({
        title: "تم حساب المسار ✅",
        description: `المسافة: ${distanceKm.toFixed(2)} كم | المدة: ${durationMin.toFixed(1)} دقيقة | السعر: ${Math.round(calculatedPrice)} دج`,
      });
    } catch (error) {
      console.error('Error calculating route:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من حساب المسار",
        variant: "destructive",
      });
    } finally {
      setCalculatingRoute(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=dz&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const dest: [number, number] = [parseFloat(lat), parseFloat(lon)];
        setDestination(dest);

        toast({
          title: "تم العثور على الموقع",
          description: data[0].display_name,
        });
      } else {
        toast({
          title: "لم يتم العثور على نتائج",
          description: "حاول البحث بطريقة أخرى",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء البحث",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const findNearestDriver = async () => {
    setIsSearchingDriver(true);
    setCandidateDriver(null);

    try {
      // 1. Fetch online drivers
      const { data: drivers, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'driver')
        .eq('is_online', true);

      if (error) throw error;

      if (!drivers || drivers.length === 0) {
        toast({
          title: "لا يوجد سائقين",
          description: "للأسف لا يوجد سائقين متاحين حالياً",
          variant: "destructive"
        });
        setIsSearchingDriver(false);
        return;
      }

      // 2. Filter out declined drivers
      const availableDrivers = drivers.filter(d => !declinedDrivers.includes(d.id));

      if (availableDrivers.length === 0) {
        toast({
          title: "لا يوجد سائقين جدد",
          description: "لقد شاهدت جميع السائقين المتاحين",
          variant: "default"
        });
        setIsSearchingDriver(false);
        return;
      }

      // 3. Sort by distance (Simple approximation using coords if available)
      // Note: Real production apps need PostGIS. Here we filter locally.
      // We assume userLocation is updated.
      if (!userLocation) {
        // Fallback: Pick random or first
        setCandidateDriver(availableDrivers[0]);
      } else {
        // Calculate distances
        const driversWithDist = availableDrivers.map(driver => {
          // Mock location for drivers if not in DB (In real app, we need driver_locations table)
          // For demo, we assume drivers are nearby or use stored location if available
          // Since we don't have realtime location stream here yet, we pick random "nearby"
          return { ...driver, distance: Math.random() * 5 };
        }).sort((a, b) => a.distance - b.distance);

        setCandidateDriver(driversWithDist[0]);
      }

    } catch (err) {
      console.error(err);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء البحث عن سائق",
        variant: "destructive"
      });
    } finally {
      setIsSearchingDriver(false);
    }
  };

  const handleEndRide = async () => {
    if (currentRideId) {
      const { error } = await supabase
        .from('rides')
        .update({ status: 'completed' })
        .eq('id', currentRideId);

      if (error) {
        console.error("Error ending ride:", error);
        toast({ title: "Error", description: "Failed to end ride", variant: "destructive" });
      } else {
        toast({ title: "Ride Completed", description: "You have arrived!" });
        // State update will happen via Realtime subscription
      }
    }
  };

  const handleDeclineCandidate = () => {
    if (candidateDriver) {
      setDeclinedDrivers(prev => [...prev, candidateDriver.id]);
      setCandidateDriver(null);
      // Immediately search for next
      findNearestDriver();
    }
  };

  const handleCancelRide = async () => {
    try {
      if (currentRideId) {
        await supabase
          .from('rides')
          .update({ status: 'cancelled' })
          .eq('id', currentRideId);
      }
    } catch (error) {
      console.error("Error cancelling ride:", error);
    }

    // Reset state
    localStorage.removeItem('currentRideId');
    setCurrentRideId(null);
    setRideStatus('idle');
    setDestination(null);
    setRoute([]);
    setSearchQuery("");
    setPrice(0);
    setDistance(0);
    setDuration(0);
    setCandidateDriver(null);
    setIsSearchingDriver(false);
  };

  const handleRequestRide = async () => {
    if (!candidateDriver) {
      // Start flow: Find driver first
      findNearestDriver();
      return;
    }

    // If candidate exists, PROCEED to create request
    if (!userId || !destination) {
      toast({
        title: "خطأ",
        description: "الرجاء تحديد الوجهة أولاً",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('rides')
        .insert({
          customer_id: userId,
          pickup_lat: userLocation?.[0],
          pickup_lng: userLocation?.[1],
          destination_lat: destination[0],
          destination_lng: destination[1],
          pickup_address: "موقعي الحالي", // Should be reverse geocoded
          destination_address: searchQuery,
          price: price,
          distance: distance,
          duration: duration,
          status: 'pending',
          driver_id: candidateDriver.id // ASSIGN SPECIFIC DRIVER
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentRideId(data.id);
      setRideStatus('pending');
      localStorage.setItem('currentRideId', data.id);

      // Clear candidate state as we moved to pending
      setCandidateDriver(null);

      toast({
        title: "تم إرسال الطلب! 🚖",
        description: `جاري انتظار قبول السائق ${candidateDriver.full_name}...`,
      });
    } catch (error: any) {
      console.error('Error requesting ride:', error);
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء طلب السيارة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRating = async (rating: number) => {
    if (!currentRideId) return;

    try {
      const { error } = await supabase
        .from('rides')
        .update({ rating })
        .eq('id', currentRideId);

      if (error) throw error;

      if (driverInfo) {
        const newRating = ((driverInfo.rating * driverInfo.total_rides) + rating) / (driverInfo.total_rides + 1);

        await supabase
          .from('users')
          .update({
            rating: newRating,
            total_rides: driverInfo.total_rides + 1,
          })
          .eq('id', driverInfo.id);
      }

      toast({
        title: "شكراً لتقييمك! ⭐",
        description: "تم حفظ التقييم بنجاح",
      });

      localStorage.removeItem('currentRideId');
      setCurrentRideId(null);
      setDriverInfo(null);
      setRideStatus('idle');
      setDestination(null);
      setRoute([]);
      setSearchQuery("");
      setPrice(0);
      setDistance(0);
      setDuration(0);
    } catch (error) {
      console.error('Error saving rating:', error);
    }
  };

  const getMarkers = () => {
    const markers: Array<{ position: [number, number]; popup?: string; icon?: string }> = [];

    markers.push({
      position: userLocation,
      popup: "موقعك الحالي",
      icon: "🧍"
    });

    if (destination && rideStatus === 'idle') {
      markers.push({
        position: destination,
        popup: "الوجهة",
        icon: "📍"
      });
    }

    // إظهار موقع السائق
    if (driverLocation && (rideStatus === 'accepted' || rideStatus === 'in_progress')) {
      markers.push({
        position: driverLocation,
        popup: driverInfo?.full_name ? `السائق: ${driverInfo.full_name}` : "السائق 🚖",
        icon: "🚗"
      });
    }

    // إظهار الوجهة أثناء الرحلة
    if (destination && rideStatus === 'in_progress') {
      markers.push({
        position: destination,
        popup: "الوجهة 🎯",
        icon: "📍"
      });
    }

    return markers;
  };

  const getRoute = () => {
    if (rideStatus === 'accepted' && driverLocation && userLocation) {
      return [driverLocation, userLocation];
    }
    if (rideStatus === 'in_progress' && userLocation && destination) {
      return [userLocation, destination];
    }
    if (rideStatus === 'idle' && route.length > 0) {
      return route;
    }
    return undefined;
  };




  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Taxi DZ</h1>
            <p className="text-xs text-muted-foreground">لوحة العميل</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={navigateToProfile}>
            <User className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 relative">
        <Map
          center={userLocation}
          markers={getMarkers()}
          onMapClick={handleMapClick}
          route={getRoute()}
        />

        <Card className={`absolute bottom-0 left-0 right-0 p-4 space-y-3 z-[1000] bg-card/95 backdrop-blur-sm border-t border-border transition-all duration-300 ${isPanelMinimized ? 'translate-y-[calc(100%-80px)]' : ''}`}>
          <div className="absolute -top-10 left-1/2 -translate-x-1/2">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full w-10 h-10 shadow-lg bg-card border border-border"
              onClick={() => setIsPanelMinimized(!isPanelMinimized)}
            >
              {isPanelMinimized ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
            </Button>
          </div>

          {!isPanelMinimized && (
            <>
              <div className="flex gap-2">
                <Input
                  placeholder="ابحث عن وجهتك..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  dir="rtl"
                  className="flex-1"
                />
                <Button
                  onClick={handleSearch}
                  disabled={loading || calculatingRoute}
                  size="icon"
                  className="bg-primary"
                >
                  <Search className="w-5 h-5" />
                </Button>
              </div>

              <Button
                onClick={getCurrentLocation}
                variant="outline"
                className="w-full"
              >
                <Navigation className="w-4 h-4 ml-2" />
                موقعي الحالي
              </Button>
            </>
          )}

          {/* Persistent Header for Minimized State */}
          {isPanelMinimized && (rideStatus === 'pending' || (destination && route.length > 0 && rideStatus === 'idle')) && (
            <div className="flex items-center justify-between px-2" dir="rtl">
              <span className="font-bold text-lg">
                {rideStatus === 'pending' ? 'جاري البحث...' : `${Math.round(price)} دج`}
              </span>
              <span className="text-sm text-muted-foreground mr-2">
                {rideStatus === 'pending' ? 'يرجى الانتظار' : 'السعر التقديري'}
              </span>
            </div>
          )}

          {/* DriverInfoCard removed from here to be rendered outside */ /*{driverInfo && rideStatus === 'accepted' && (
            <DriverInfoCard driver={driverInfo} />
          )} */}

          {destination && route.length > 0 && rideStatus === 'idle' && !isPanelMinimized && (
            <div className="space-y-3 bg-background rounded-lg p-4 border border-border">
              <div className="space-y-2" dir="rtl">
                <h3 className="font-bold text-lg">معلومات الرحلة</h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>📍 من: موقعك الحالي</p>
                  <p>🎯 إلى: {searchQuery}</p>
                </div>
              </div>

              <div className="space-y-2" dir="rtl">
                <h4 className="font-semibold text-base">السعر</h4>
                <div className="flex items-center justify-between bg-primary/5 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-foreground">{Math.round(price)} دج</span>
                  </div>
                  <span className="text-sm text-muted-foreground">💵 نقداً</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm" dir="rtl">
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">المسافة</p>
                  <p className="font-bold text-foreground">{distance.toFixed(2)} كم</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">المدة المتوقعة</p>
                  <p className="font-bold text-foreground">{duration.toFixed(0)} دقيقة</p>
                </div>
              </div>

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-6 text-base shadow-lg"
                onClick={handleRequestRide}
                disabled={loading}
              >
                🚖 اطلب سيارة الآن
              </Button>

              <div className="flex items-center gap-2" dir="rtl">
                <Button
                  variant="ghost"
                  className="flex-1 text-muted-foreground"
                  onClick={() => {
                    setDestination(null);
                    setRoute([]);
                    setSearchQuery("");
                    setPrice(0);
                    setDistance(0);
                    setDuration(0);
                  }}
                >
                  ❌ إلغاء
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 text-muted-foreground"
                >
                  ❓ تحتاج مساعدة؟
                </Button>
              </div>
            </div>
          )}

          {rideStatus === 'pending' && !isPanelMinimized && (
            <div className="space-y-3 bg-background rounded-lg p-4 border border-border">
              <div className="flex flex-col items-center gap-4 py-8 animate-in fade-in zoom-in duration-300">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#F5D848] blur-xl opacity-20 animate-pulse"></div>
                  <Loader2 className="w-12 h-12 animate-spin text-[#F5D848] relative z-10" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-bold text-white">في انتظار قبول السائق...</h3>
                  <p className="text-gray-400 text-sm">Waiting for driver acceptance...</p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleCancelRide}
                  className="mt-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full max-w-xs"
                >
                  Cancel Request (إلغاء)
                </Button>
              </div>
              <div className="space-y-2" dir="rtl">
                <h4 className="font-semibold text-base">مسار الرحلة</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>📍 {searchQuery}</p>
                </div>
              </div>

              <div className="space-y-2" dir="rtl">
                <h4 className="font-semibold text-base">السعر</h4>
                <div className="flex items-center justify-between bg-primary/5 rounded-lg p-3">
                  <span className="text-xl font-bold text-foreground">{Math.round(price)} دج</span>
                  <span className="text-sm text-muted-foreground">💵 نقداً</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2" dir="rtl">
                <Button
                  variant="ghost"
                  className="text-muted-foreground"
                >
                  ❓ تحتاج مساعدة؟
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    if (currentRideId) {
                      await supabase
                        .from('rides')
                        .update({ status: 'cancelled' })
                        .eq('id', currentRideId);

                      localStorage.removeItem('currentRideId');
                      setCurrentRideId(null);
                      setRideStatus('idle');
                      setDestination(null);
                      setRoute([]);
                      setSearchQuery("");
                      setPrice(0);
                      setDistance(0);
                      setDuration(0);

                      toast({
                        title: "تم إلغاء الطلب",
                        description: "يمكنك طلب رحلة جديدة في أي وقت",
                      });
                    }
                  }}
                >
                  ❌ إلغاء الطلب
                </Button>
              </div>
            </div>
          )}

          {calculatingRoute && (
            <div className="text-center text-sm text-muted-foreground">
              جاري حساب المسار...
            </div>
          )}

          {/* Candidate Driver Popup (Pre-Approval) */}
          {candidateDriver && (
            <div className="absolute bottom-4 left-4 right-4 z-[2000] animate-in slide-in-from-bottom-5">
              <div className="bg-[#1A1A1A] text-white rounded-2xl p-4 shadow-2xl border border-white/10">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg mb-1">اقتراح سائق (Choose a driver)</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold">{Math.round(price)} دج</span>
                      <span className="text-sm text-gray-400">{duration.toFixed(0)} min</span>
                    </div>
                    <div className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full w-fit mt-1 flex items-center gap-1">
                      <span>👍</span> السعر العادل
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCandidateDriver(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    X
                  </Button>
                </div>

                <div className="flex items-center gap-3 mb-6 bg-white/5 p-3 rounded-xl">
                  <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden">
                    <img
                      src={candidateDriver.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${candidateDriver.full_name}`}
                      alt="Driver"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{candidateDriver.full_name}</span>
                      <span className="flex items-center text-yellow-500 text-sm">
                        ★ {candidateDriver.rating || "5.0"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {candidateDriver.total_rides || 0} رحلة • {candidateDriver.car_model || "سيارة أجرة"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="bg-gray-700 hover:bg-gray-600 border-0 text-white h-12 rounded-xl font-bold"
                    onClick={handleDeclineCandidate}
                  >
                    Decline (رفض)
                  </Button>
                  <Button
                    className="bg-[#84cc16] hover:bg-[#65a30d] text-black h-12 rounded-xl font-bold text-lg"
                    onClick={handleRequestRide}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin" /> : "Accept (قبول)"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isSearchingDriver && (
            <div className="absolute inset-0 z-[2001] bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center">
              <div className="bg-white p-6 rounded-full animate-bounce mb-4">
                <Search className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-white font-bold text-xl">جاري البحث عن أقرب سائق...</h3>
            </div>
          )}
        </Card>

        {/* Driver Info Card (Professional UI) - Rendered outside to overlap properly */}
        {driverInfo && (rideStatus === 'accepted' || rideStatus === 'in_progress') && (
          <DriverInfoCard
            driver={driverInfo}
            rideStatus={rideStatus}
            onCancel={handleCancelRide}
            onEndRide={handleEndRide}
          />
        )}
      </div>

      {driverInfo && (
        <RatingDialog
          open={showRating}
          onOpenChange={setShowRating}
          onSubmit={handleRating}
          driverName={driverInfo.full_name}
        />
      )}
    </div>
  );
};

export default CustomerDashboard;
