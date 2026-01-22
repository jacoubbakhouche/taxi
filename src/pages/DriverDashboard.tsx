
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import Map from "@/components/Map";
import RideRequestCard from "@/components/RideRequestCard";
import RatingDialog from "@/components/RatingDialog";
import { Car, Navigation, LogOut, Power, CheckCircle, Clock, MapPin, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [ignoredRideIds, setIgnoredRideIds] = useState<string[]>([]);



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

  // Refs to avoid re-subscribing when these values change (especially location)
  const driverLocationRef = useRef(driverLocation);
  const ignoredRideIdsRef = useRef(ignoredRideIds);
  const currentRideRef = useRef(currentRide); // Also ref currentRide to check inside callback without dep

  useEffect(() => {
    driverLocationRef.current = driverLocation;
  }, [driverLocation]);

  useEffect(() => {
    ignoredRideIdsRef.current = ignoredRideIds;
  }, [ignoredRideIds]);

  useEffect(() => {
    currentRideRef.current = currentRide;
  }, [currentRide]);

  useEffect(() => {
    // We only subscribe if online and logged in.
    // We do NOT include driverLocation/currentRide/ignoredIds in dependency array
    // because that would cause disconnect/reconnect loops.
    if (!isOnline || !userId) return;

    console.log("Starting Realtime Subscription...");

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
          console.log('New ride request received:', ride);

          // Check busy status via Ref
          if (currentRideRef.current) {
            console.log("Driver is busy, ignoring request.");
            return;
          }

          // If ride is assigned to a specific driver, ignore if it's not ME.
          if (ride.driver_id && ride.driver_id !== userId) {
            console.log('Ignoring ride assigned to another driver');
            return;
          }

          // Check if ignored via Ref
          if (ignoredRideIdsRef.current.includes(ride.id)) {
            console.log('Ignoring previously rejected ride');
            return;
          }

          // Calculate distance using Ref
          const location = driverLocationRef.current;
          const distance = calculateDistance(
            location[0],
            location[1],
            ride.pickup_lat,
            ride.pickup_lng
          );

          console.log(`Ride distance: ${distance} km`);

          // Broadened range slightly or keep as is
          if (distance <= 10) {
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
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    return () => {
      console.log("Cleaning up subscription...");
      supabase.removeChannel(channel);
    };
  }, [isOnline, userId]); // Stable dependencies only

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
            variant={isOnline ? "default" : "destructive"}
            className={cn("rounded-full shadow-lg transition-all", isOnline ? "bg-green-500 hover:bg-green-600" : "")}
            onClick={toggleOnline}
          >
            <Power className="w-5 h-5 text-white" />
          </Button>

          {/* Profile */}
          <Button size="icon" variant="secondary" className="rounded-full shadow-lg" onClick={() => navigate("/driver/profile")}>
            <User className="w-5 h-5" />
          </Button>

          {/* Logout */}
          <Button size="icon" variant="secondary" className="rounded-full shadow-lg bg-red-500/10 hover:bg-red-500/20 text-red-500" onClick={handleLogout}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* --- Map Layer --- */}
      <div className="absolute inset-0 z-0">
        <Map
          center={driverLocation}
          markers={getMarkers()}
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
            {/* Trip Progress (Top) */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2 px-1">
                <div>
                  <span className="text-2xl font-bold text-white">1.3</span> <span className="text-xs text-gray-500">km</span>
                </div>
                <div className="text-gray-600">•</div>
                <div>
                  <span className="text-2xl font-bold text-white">2</span> <span className="text-xs text-gray-500">min</span>
                </div>
              </div>
              <div className="relative h-2 bg-gray-800 rounded-full mx-1">
                <div className="absolute top-0 left-0 bottom-0 bg-[#84cc16] w-2/3 rounded-full shadow-[0_0_10px_#84cc16]"></div>
                <div className="absolute top-1/2 left-2/3 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-[#84cc16]">
                  <Navigation className="w-3 h-3 text-[#84cc16] fill-current transform rotate-45" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 px-1">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-bold text-white">03:36 PM</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider ml-1">ESTIMATED ARRIVAL</span>
              </div>
            </div>

            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                    currentRide.status === 'in_progress' ? "bg-blue-500 text-white" : "bg-yellow-500 text-black"
                  )}>
                    {currentRide.status === 'in_progress' ? "IN TRIP" : "ACCEPTED"}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white">
                  {currentRide.status === 'in_progress' ? "Heading to Destination" : "Picking up Customer"}
                </h2>
              </div>
              {/* Actions */}
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
                <div className="flex items-center gap-1 text-xs text-yellow-500">
                  <span>★</span> {customerInfo?.rating?.toFixed(1) || "5.0"} ({customerInfo?.total_rides || 0} rides)
                </div>
              </div>
              <div className="flex-1 text-right">
                <p className="text-xl font-bold text-white">{currentRide.final_price || currentRide.price} DA</p>
                <p className="text-xs text-gray-500">CASH</p>
              </div>
            </div>

            {/* Trip Progress Stats */}
            <div className="flex justify-between items-center mb-2 px-2">
              <div>
                <span className="text-2xl font-bold text-white">1.3</span> <span className="text-xs text-gray-500">km</span>
              </div>
              <div className="text-gray-600">
                •
              </div>
              <div>
                <span className="text-2xl font-bold text-white">2</span> <span className="text-xs text-gray-500">min</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-2 bg-gray-800 rounded-full mb-6 mx-2">
              <div className="absolute top-0 left-0 bottom-0 bg-[#84cc16] w-2/3 rounded-full shadow-[0_0_10px_#84cc16]"></div>
              <div className="absolute top-1/2 left-2/3 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-[#84cc16]">
                <Navigation className="w-3 h-3 text-[#84cc16] fill-current transform rotate-45" />
              </div>
            </div>

            {/* Arrival Time */}
            <div className="flex items-center gap-3 mb-6 px-2">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                <Car className="w-5 h-5 text-[#F5D848]" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">03:36 PM</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">ESTIMATED ARRIVAL</p>
              </div>
            </div>

            {/* Complete Button */}
            <Button
              size="lg"
              className="w-full h-14 text-lg font-bold rounded-xl bg-[#F5D848] text-black hover:bg-[#F5D848]/90 shadow-lg shadow-yellow-500/10"
              onClick={handleCompleteRide}
            >
              <CheckCircle className="mr-2 w-6 h-6" /> COMPLETE RIDE
            </Button>
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
