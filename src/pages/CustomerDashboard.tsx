import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import Map from "@/components/Map";
import DriverInfoCard from "@/components/DriverInfoCard";
import RatingDialog from "@/components/RatingDialog";
import { MapPin, Navigation, LogOut, Search, User, ChevronDown, ChevronUp } from "lucide-react";

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
        const { data: ride, error } = await supabase
          .from('rides')
          .select('*')
          .eq('id', currentRideId)
          .single();

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

  const [offers, setOffers] = useState<any[]>([]);

  // Listen for offers
  useEffect(() => {
    if (!currentRideId || rideStatus !== 'pending') return;

    // Load existing offers
    const fetchOffers = async () => {
      const { data: existingOffers } = await supabase
        .from('ride_offers')
        .select(`
          *,
          driver:driver_id (
            id,
            full_name,
            rating,
            total_rides,
            profile_image,
            car_type,
            car_color,
            car_plate
          )
        `)
        .eq('ride_id', currentRideId);

      if (existingOffers) {
        setOffers(existingOffers);
      }
    };

    fetchOffers();

    const channel = supabase
      .channel('ride-offers')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_offers',
          filter: `ride_id=eq.${currentRideId}`,
        },
        async (payload) => {
          const newOffer = payload.new;

          // Fetch driver details for the new offer
          const { data: driverData } = await supabase
            .from('users')
            .select('id, full_name, rating, total_rides, profile_image, car_type, car_color, car_plate')
            .eq('id', newOffer.driver_id)
            .single();

          if (driverData) {
            setOffers(prev => [...prev, { ...newOffer, driver: driverData }]);
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi56+mjUBELUKzn77ljHAU7k9j0y3ktBSh+zPLaizsKGGS36Oynaw==');
            audio.play().catch(e => console.log('Audio play failed:', e));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRideId, rideStatus]);

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

  const handleRequestRide = async () => {
    if (!destination || !userId) return;

    try {
      setLoading(true);

      const { data: ride, error } = await supabase
        .from('rides')
        .insert({
          customer_id: userId,
          pickup_lat: userLocation[0],
          pickup_lng: userLocation[1],
          destination_lat: destination[0],
          destination_lng: destination[1],
          pickup_address: 'موقعك الحالي',
          destination_address: searchQuery,
          distance: distance,
          duration: Math.round(duration),
          price: price,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentRideId(ride.id);
      setRideStatus('pending');
      localStorage.setItem('currentRideId', ride.id);

      toast({
        title: "تم إرسال الطلب! 📲",
        description: "جاري البحث عن سائق قريب منك...",
      });
    } catch (error) {
      console.error('Error creating ride:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من إرسال الطلب",
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

  const handleAcceptOffer = async (offer: any) => {
    try {
      setLoading(true);

      // 1. Update Ride Status
      const { error: rideError } = await supabase
        .from('rides')
        .update({
          status: 'accepted',
          driver_id: offer.driver_id,
          final_price: offer.amount,
        })
        .eq('id', currentRideId);

      if (rideError) throw rideError;

      // 2. Mark Offer as Accepted
      await supabase
        .from('ride_offers')
        .update({ accepted: true })
        .eq('id', offer.id);

      setRideStatus('accepted');
      setDriverInfo(offer.driver);

      toast({
        title: "تم قبول العرض! ✅",
        description: "السائق في الطريق إليك",
      });

    } catch (error) {
      console.error('Error accepting offer:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء قبول العرض",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
                {rideStatus === 'pending' ? (offers.length > 0 ? `${offers.length} عروض` : 'جاري البحث...') : `${Math.round(price)} دج`}
              </span>
              <span className="text-sm text-muted-foreground mr-2">
                {rideStatus === 'pending' ? 'يرجى الانتظار' : 'السعر التقديري'}
              </span>
            </div>
          )}

          {driverInfo && rideStatus === 'accepted' && (
            <DriverInfoCard driver={driverInfo} />
          )}

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
              {offers.length > 0 ? (
                <div className="space-y-3" dir="rtl">
                  <h3 className="font-bold text-lg mb-2">عروض السائقين ({offers.length})</h3>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {offers.map((offer) => (
                      <div key={offer.id} className="bg-muted/30 p-3 rounded-lg border border-border flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20 bg-background">
                            {offer.driver.profile_image ? (
                              <img src={offer.driver.profile_image} alt={offer.driver.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-full h-full p-2 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{offer.driver.full_name}</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span>⭐ {offer.driver.rating?.toFixed(1) || '5.0'}</span>
                              <span>•</span>
                              <span>{offer.driver.car_type || 'سيارة'}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{offer.driver.car_plate}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <p className="font-bold text-lg text-primary">{Math.round(offer.amount)} دج</p>
                          <Button
                            size="sm"
                            onClick={() => handleAcceptOffer(offer)}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700 text-white h-8 px-4"
                          >
                            قبول
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4" dir="rtl">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <h3 className="font-bold text-lg mb-1">جاري البحث عن سائق...</h3>
                  <p className="text-sm text-muted-foreground">
                    يرجى الانتظار بينما نتواصل مع أقرب سائق
                  </p>
                </div>
              )}

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
        </Card>
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
