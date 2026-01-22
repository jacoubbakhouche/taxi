
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import Map from "@/components/Map";
import RideRequestCard from "@/components/RideRequestCard";
import { Car, Navigation, LogOut, Power, CheckCircle, Clock, MapPin, User, Loader2 } from "lucide-react";

const DriverDashboard = () => {
  const navigate = useNavigate();
  const [driverLocation, setDriverLocation] = useState<[number, number]>([36.7372, 3.0865]);
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



  useEffect(() => {
    checkAuth();
    getCurrentLocation();
  }, []);

  // Restore active ride state when userId is available
  // Restore active ride state when userId is available
  useEffect(() => {
    const restoreActiveRide = async () => {
      // 1. Initial check from LocalStorage for speed
      const savedRideId = localStorage.getItem('activeRideId');
      if (savedRideId && !currentRide) {
        console.log("Found active ride in local storage:", savedRideId);
        // We could fetch this specific ride directly for perceived speed, 
        // but checking "any active ride" is safer for consistency.
      }

      if (!userId) return;

      const { data: activeRide, error } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', userId)
        .in('status', ['accepted', 'in_progress'])
        .maybeSingle();

      if (activeRide && !error) {
        console.log("Restored active ride from DB:", activeRide);
        setCurrentRide(activeRide);
        localStorage.setItem('activeRideId', activeRide.id);

        // If we have an active ride, we need customer info too
        if (activeRide.customer_id) {
          const { data: customerData } = await supabase
            .from('users')
            .select('id, full_name, phone, rating, total_rides, profile_image')
            .eq('id', activeRide.customer_id)
            .single();

          if (customerData) {
            setCustomerInfo(customerData);
            if (activeRide.status === 'accepted') {
              setCustomerLocation([activeRide.pickup_lat, activeRide.pickup_lng]);
              setDestinationLocation([activeRide.destination_lat, activeRide.destination_lng]);
            } else if (activeRide.status === 'in_progress') {
              setCustomerLocation([activeRide.pickup_lat, activeRide.pickup_lng]); // Keep pickup as origin
              setDestinationLocation([activeRide.destination_lat, activeRide.destination_lng]);
            }
          }
        }
      } else {
        // No active ride found in DB, clear local storage just in case
        localStorage.removeItem('activeRideId');
      }
    };

    restoreActiveRide();
  }, [userId]);

  useEffect(() => {
    // Prevent busy drivers from getting new requests
    if (!isOnline || !userId || !driverLocation || currentRide) return;

    // 1. Listen for NEW pending rides
    const channel = supabase
      .channel('pending-rides')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rides',
          filter: 'status=eq.pending',
        },
        async (payload) => {
          const ride = payload.new as Ride;
          console.log('New ride request:', ride);

          // If ride is assigned to a specific driver, ignore if it's not ME.
          if (ride.driver_id && ride.driver_id !== userId) {
            console.log('Ignoring ride assigned to another driver');
            return;
          }

          // Check if we locally ignored this ride
          if (ignoredRideIds.includes(ride.id)) {
            console.log('Ignoring previously rejected ride');
            return;
          }

          const distance = calculateDistance(
            driverLocation[0],
            driverLocation[1],
            ride.pickup_lat,
            ride.pickup_lng
          );

          if (distance <= 5) {
            setPendingRide(ride);

            // Fetch customer info
            const { data: customerData } = await supabase
              .from('users')
              .select('id, full_name, phone, rating, total_rides, profile_image')
              .eq('id', ride.customer_id)
              .single();

            if (customerData) {
              setCustomerInfo(customerData);
            }

            setIsSheetExpanded(true);

            // Play sound
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi56+mjUBELUKzn77ljHAU7k9j0y3ktBSh+zPLaizsKGGS36Oynaw==');
            audio.play().catch(e => console.log('Audio play failed:', e));

            toast({
              title: "طلب جديد! 🚖",
              description: `عميل على بعد ${distance.toFixed(1)} كم منك`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOnline, userId, driverLocation, currentRide, ignoredRideIds]);

  // 2. NEW: Listen for updates/delete to the CURRENT pending ride
  useEffect(() => {
    if (!pendingRide) return;

    const channel = supabase
      .channel(`ride-${pendingRide.id}-updates`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `id=eq.${pendingRide.id}`,
        },
        (payload) => {
          console.log("Pending ride updated/deleted:", payload);

          if (payload.eventType === 'DELETE' || (payload.new && payload.new.status !== 'pending')) {
            console.log("Ride taken, cancelled, or deleted:", payload);
            setPendingRide(null);
            setCustomerInfo(null);
            setIsSheetExpanded(false);

            toast({
              title: "الطلب لم يعد متاحاً ❌",
              description: "تم قبول الرحلة من قبل سائق آخر أو تم إلغاؤها",
              variant: "destructive"
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pendingRide]);

  // 3. Fallback: Polling for pending ride status (in case Realtime fails or RLS hides the update)
  useEffect(() => {
    if (!pendingRide) return;

    const interval = setInterval(async () => {
      const { data: ride, error } = await supabase
        .from('rides')
        .select('status')
        .eq('id', pendingRide.id)
        .single();

      if (error || !ride || ride.status !== 'pending') {
        console.log("Polling found pending ride invalid:", ride);
        setPendingRide(null);
        setCustomerInfo(null);
        setIsSheetExpanded(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [pendingRide]);

  useEffect(() => {
    if (!isOnline || !userId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const newLocation: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        setDriverLocation(newLocation);

        // Use RPC to update driver location (PostGIS)
        const { error: locationError } = await supabase
          .rpc('update_driver_location', {
            p_lat: newLocation[0],
            p_lng: newLocation[1]
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
      (error) => console.error('Error watching location:', error),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isOnline, userId, currentRide, customerLocation]);

  // 3. NEW: Check for EXISTING pending rides on mount/resume
  useEffect(() => {
    if (!isOnline || !userId || !driverLocation || pendingRide || currentRide) return;

    const fetchPendingRides = async () => {
      console.log("Checking for existing pending rides...");
      const { data: rides, error } = await supabase
        .from('rides')
        .select('*')
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching pending rides:', error);
        return;
      }

      if (rides && rides.length > 0) {
        // Find the closest ride
        let closestRide = null;
        let minDistance = Infinity;

        for (const ride of rides) {
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
  }, [isOnline, userId, driverLocation, pendingRide, currentRide]);

  const checkAuth = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        navigate("/driver/auth");
        return;
      }

      // Retry fetching user profile 3 times with delay
      let user = null;
      let userError = null;

      for (let i = 0; i < 3; i++) {
        const result = await supabase
          .from('users')
          .select('id, is_online')
          .eq('auth_id', session.user.id)
          .single();

        if (result.data) {
          user = result.data;
          userError = null;
          break;
        }
        userError = result.error;
        if (result.error?.code === 'PGRST116') {
          // Not found, wait and retry as it might be a race condition on signup
          await new Promise(r => setTimeout(r, 1000));
        } else {
          // Other error (auth/RLS), break immediately
          break;
        }
      }

      if (userError) {
        console.error("User profile fetch error:", userError);

        if (userError.code === 'PGRST116') {
          toast({
            title: "الحساب غير مكتمل",
            description: "بيانات السائق غير موجودة. يرجى التواصل مع الدعم.",
            variant: "destructive",
          });
          // Optional: navigate to a "Complete Profile" page instead of auth
          return;
        }

        throw userError;
      }

      if (user) {
        setUserId(user.id);
        setIsOnline(user.is_online || false);
      }
    } catch (error: any) {
      console.error("Auth check failed:", error);
      // Only redirect to auth if it's strictly a session/auth issue
      if (error.message?.includes('JWT') || error.message?.includes('session')) {
        toast({
          title: "جلسة منتهية",
          description: "يرجى تسجيل الدخول مرة أخرى",
          variant: "destructive",
        });
        navigate("/driver/auth");
      } else {
        toast({
          title: "خطأ في الاتصال",
          description: "حدث خطأ أثناء تحميل البيانات. حاول مرة أخرى.",
          variant: "destructive",
        });
      }
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

  const [locationKey, setLocationKey] = useState(0);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDriverLocation([position.coords.latitude, position.coords.longitude]);
          setLocationKey(prev => prev + 1); // Force map re-center
        },
        (error) => {
          console.error("Error getting location:", error);
          toast({
            title: "تنبيه",
            description: "تأكد من تفعيل خدمة الموقع الجغرافي",
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

  const toggleOnline = async () => {
    if (!userId) {
      toast({
        title: "غير متصل",
        description: "جاري التحقق من الحساب... حاول مرة أخرى خلال ثوانٍ",
        variant: "default",
      });
      checkAuth(); // Retry auth check
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

      setPendingRide(null);
      setCustomerInfo(null);
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

  const [ignoredRideIds, setIgnoredRideIds] = useState<string[]>([]);

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
        description: "شكراً لك",
      });

      setCurrentRide(null);
      setCustomerLocation(null);
      setDestinationLocation(null);
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

  return (
    <div className="h-screen flex flex-col bg-background relative overflow-hidden">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
            <Car className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">Taxi DZ</h1>
            <p className="text-xs text-muted-foreground">Driver Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_10px_#4ade80]' : 'bg-red-500'} transition-all duration-300`} />
          <Button variant="ghost" size="icon" onClick={() => navigate("/driver/profile")} className="text-foreground hover:bg-white/10 rounded-full">
            <User className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-foreground hover:bg-white/10 rounded-full">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 relative">
        <Map center={driverLocation} markers={getMarkers()} route={getRoute()} zoom={14} recenterKey={locationKey} />

        {/* Distance & Duration Overlay */}
        {pendingRide && (
          <Card className="absolute top-4 left-1/2 -translate-x-1/2 p-3 z-[999] bg-[#1A1A1A]/90 backdrop-blur-md border border-[#F5D848]">
            <div className="flex items-center gap-4 text-sm" dir="rtl">
              <div className="flex items-center gap-1 text-white">
                <MapPin className="w-4 h-4 text-[#F5D848]" />
                <span className="font-bold">{pendingRide.distance?.toFixed(1)} كم</span>
              </div>
              <div className="flex items-center gap-1 text-white">
                <Clock className="w-4 h-4 text-[#F5D848]" />
                <span className="font-bold">{pendingRide.duration?.toFixed(0)} دقيقة</span>
              </div>
            </div>
          </Card>
        )}

        {/* Professional Navigation UI Overlay - Only show when Online/Active */}
        {/* IDLE STATE UI: Online/Offline Button & Waiting Indicator */}
        {!currentRide && !pendingRide && (
          <div className="absolute bottom-8 left-4 right-4 z-[1000] space-y-3 pointer-events-none">
            <div className="pointer-events-auto space-y-3">
              <Button
                onClick={toggleOnline}
                disabled={loading}
                className={`w-full h-16 text-xl font-bold shadow-lg transition-all duration-300 rounded-2xl ${isOnline
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-[#F5D848] hover:bg-[#FCC419] text-black"
                  }`}
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Power className="w-6 h-6 ml-2" />}
                {isOnline ? "إيقاف الاتصال (Offline)" : "اتصل الآن (Go Online)"}
              </Button>

              <Button
                onClick={getCurrentLocation}
                variant="secondary"
                className="w-full bg-[#1A1A1A] text-white hover:bg-[#333] border border-[#333] h-12 rounded-xl"
              >
                <Navigation className="w-4 h-4 ml-2" />
                تحديث الموقع
              </Button>
            </div>

            {isOnline && (
              <Card className="p-3 bg-[#1A1A1A]/90 border border-[#333] backdrop-blur-md mx-auto w-fit pointer-events-auto">
                <p className="text-center text-sm text-[#888] flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  في انتظار طلبات جديدة...
                </p>
              </Card>
            )}
          </div>
        )}

        {/* PENDING RIDE REQUEST CARD */}
        {pendingRide && (
          <div className="absolute bottom-0 left-0 right-0 z-[1001] p-0">
            <RideRequestCard
              ride={{
                id: pendingRide.id,
                pickup_address: pendingRide.pickup_address,
                destination_address: pendingRide.destination_address,
                distance: pendingRide.distance || 0,
                duration: pendingRide.duration || 0,
                price: pendingRide.price || 0,
                pickup_lat: pendingRide.pickup_lat,
                pickup_lng: pendingRide.pickup_lng,
              }}
              customer={customerInfo}
              onAccept={handleAcceptRide}
              onInstantAccept={handleInstantAccept}
              onReject={handleRejectRide}
              onCustomerClick={handleCustomerClick}
              loading={loading}
              isExpanded={isSheetExpanded}
              onToggleExpand={() => setIsSheetExpanded(!isSheetExpanded)}
            />
          </div>
        )}

        {/* ACTIVE RIDE NAVIGATION UI */}
        {currentRide && (
          <>
            {/* Top Navigation Header (Turn-by-Turn) */}
            <div className="absolute top-4 left-0 right-0 z-[1000] flex justify-center px-4 pointer-events-none">
              <div className="bg-[#1A1A1A] text-white rounded-[2rem] px-6 py-4 flex items-center gap-4 shadow-2xl min-w-[280px] pointer-events-auto border border-gray-800/50 backdrop-blur-md">
                <div className="w-12 h-12 rounded-full border-2 border-white/20 overflow-hidden flex-shrink-0">
                  <img
                    src={customerInfo?.profile_image || "https://github.com/shadcn.png"}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="bg-white/10 p-1.5 rounded-lg">
                      <Navigation className="w-6 h-6 text-white rotate-90" fill="currentColor" />
                    </div>
                    <span className="text-3xl font-bold tracking-tight">
                      {calculateDistance(
                        driverLocation[0],
                        driverLocation[1],
                        currentRide.status === 'accepted' ? currentRide.pickup_lat : currentRide.destination_lat,
                        currentRide.status === 'accepted' ? currentRide.pickup_lng : currentRide.destination_lng
                      ).toFixed(1)}
                      <span className="text-xl text-gray-400 font-normal"> km</span>
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-[#F5D848] font-bold mb-1">
                      {currentRide.status === 'accepted' ? "PICKUP (الركوب)" : "DROPOFF (الوجهة)"}
                    </span>
                    <p className="text-gray-400 text-sm font-medium tracking-wide truncate max-w-[200px] mx-auto">
                      {(currentRide.status === 'accepted' ? currentRide.pickup_address : currentRide.destination_address)?.split(',')[0]}
                    </p>
                  </div>
                </div>
                <div
                  onClick={getCurrentLocation}
                  className="w-10 h-10 rounded-full bg-[#2A2A2A] flex items-center justify-center cursor-pointer hover:bg-[#333] transition-colors"
                >
                  <Navigation className="w-5 h-5 text-[#F5D848]" />
                </div>
              </div>
            </div>

            {/* Speedometer (Left Side) */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-4 pointer-events-none">
              <div className="bg-[#1A1A1A]/90 backdrop-blur rounded-[2rem] p-3 flex flex-col items-center gap-2 border border-white/5 shadow-xl w-20 pointer-events-auto">
                <div className="w-14 h-14 rounded-full border-[3px] border-red-500/80 flex items-center justify-center bg-[#251010]">
                  <span className="text-2xl font-bold text-white">60</span>
                </div>
                <span className="text-4xl font-bold text-white tracking-tighter">00</span>
              </div>
            </div>

            {/* Bottom Trip Progress & Controls */}
            <div className="absolute bottom-8 left-4 right-4 z-[1000] flex flex-col gap-4 pointer-events-none">

              {/* Trip Progress Bar Card */}
              <div className="bg-[#1A1A1A] rounded-[2rem] p-5 shadow-2xl border border-white/5 backdrop-blur-xl pointer-events-auto">
                {/* Stats Row */}
                <div className="flex justify-center items-baseline gap-2 mb-6">
                  <span className="text-2xl font-bold text-white">{(currentRide.distance || 0).toFixed(1)}</span>
                  <span className="text-sm text-gray-400 font-medium">km</span>
                  <span className="text-gray-600 mx-2">•</span>
                  <span className="text-2xl font-bold text-white">{(currentRide.duration || 0).toFixed(0)}</span>
                  <span className="text-sm text-gray-400 font-medium">min</span>
                </div>

                {/* Custom Progress Slider Visual */}
                <div className="relative h-2 bg-gray-800 rounded-full mb-6 mx-2">
                  {/* Active Path (Green) */}
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-[#55F079] rounded-full shadow-[0_0_15px_rgba(85,240,121,0.4)] transition-all duration-1000"
                    style={{
                      width: (() => {
                        if (!currentRide || !driverLocation) return '0%';
                        if (currentRide.status === 'accepted' && customerLocation) {
                          // Progress to Pickup
                          const totalDist = calculateDistance(currentRide.pickup_lat, currentRide.pickup_lng, currentRide.destination_lat, currentRide.destination_lng) + calculateDistance(driverLocation[0], driverLocation[1], currentRide.pickup_lat, currentRide.pickup_lng); // Rough approx for now
                          return '50%'; // Simplified for now as we don't have start point of driver
                        }
                        if (currentRide.status === 'in_progress' && customerLocation && destinationLocation) {
                          // Progress to Destination
                          const totalDist = calculateDistance(currentRide.pickup_lat, currentRide.pickup_lng, currentRide.destination_lat, currentRide.destination_lng);
                          const remainingDist = calculateDistance(driverLocation[0], driverLocation[1], currentRide.destination_lat, currentRide.destination_lng);
                          const progress = Math.min(100, Math.max(0, ((totalDist - remainingDist) / totalDist) * 100));
                          return `${progress}%`;
                        }
                        return '0%';
                      })()
                    }}
                  ></div>

                  {/* Car Position Indicator (Yellow Arrow) */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 translate-x-1/2 z-10 filter drop-shadow-[0_0_8px_rgba(245,216,72,0.6)] transition-all duration-1000"
                    style={{
                      right: (() => {
                        if (!currentRide || !driverLocation) return '0%';
                        if (currentRide.status === 'in_progress' && customerLocation && destinationLocation) {
                          const totalDist = calculateDistance(currentRide.pickup_lat, currentRide.pickup_lng, currentRide.destination_lat, currentRide.destination_lng);
                          const remainingDist = calculateDistance(driverLocation[0], driverLocation[1], currentRide.destination_lat, currentRide.destination_lng);
                          const progress = Math.min(100, Math.max(0, ((totalDist - remainingDist) / totalDist) * 100));
                          return `${progress}%`;
                        }
                        return '0%';
                      })()
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L2 22L12 18L22 22L12 2Z" fill="#F5D848" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {/* Bottom Action Area */}
                <div className="flex items-center justify-end gap-4 mt-2">
                  <div className="flex items-center gap-3">
                    {/* Placeholder for alignment if needed, or just empty */}
                  </div>
                </div>

                {/* Primary Action Button (Arrived / Complete) */}

                {/* Primary Action Button (Arrived Only - Customer Ends Ride) */}
                {currentRide.status === 'accepted' && (
                  <Button
                    onClick={handleCompleteRide}
                    className="w-full h-16 mt-6 bg-[#F5D848] hover:bg-[#E5C838] text-black text-xl font-bold rounded-2xl shadow-[0_0_20px_rgba(245,216,72,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Arrived (وصلت للعميل)
                  </Button>
                )}

                {currentRide.status === 'in_progress' && (
                  <div className="w-full h-16 mt-6 bg-[#1A1A1A] text-white flex items-center justify-between px-6 rounded-2xl border border-white/10 shadow-lg animate-in fade-in zoom-in duration-300">
                    <span className="text-gray-400 font-medium text-sm">Total Price (السعر)</span>
                    <span className="text-2xl font-bold text-[#F5D848] tabular-nums">{Math.round(currentRide.price || 0)} <span className="text-sm text-white">DZD</span></span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div >
    </div >
  );
};

export default DriverDashboard;
