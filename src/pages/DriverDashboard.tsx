
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
  // INITIALIZE TO NULL to prevent showing default "old" area
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

  // ... (inside checkAuth) update this state


  useEffect(() => {
    checkAuth();
    // getCurrentLocation(); // REMOVED: Don't fetch single time, rely on watch
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

    console.log("Starting High-Accuracy GPS Watch...");

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
        .eq('status', 'pending')
        .or(`driver_id.is.null,driver_id.eq.${userId}`);

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
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!result.error && result.data) {
          user = result.data;
          // @ts-ignore
          user.documents_submitted = result.data.documents_submitted;
          userError = null;
          break;
        }

        userError = result.error;
        if (!result.data && !result.error) {
          // Not found but no error (maybeSingle returned null)
          // Treat as error for now or loop
          userError = { message: "User profile not found", code: "PGRST116" };
        }

        if (userError?.code === 'PGRST116') {
          // Not found, wait and retry as it might be a race condition on signup
          await new Promise(r => setTimeout(r, 1000));
        } else {
          break;
        }
      }

      if (userError || !user) {
        console.error("User profile fetch error:", userError);
        // User authenticated but profile missing/error.
        // Show Toast and Redirect/Logout option.
        toast({
          title: "Access Error",
          description: "Your profile could not be loaded.",
          variant: "destructive",
          action: (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { supabase.auth.signOut(); navigate("/"); }}>
                Log Out
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          )
        });

        // Don't show "Upload Docs" (which happens if we just setVerified(false)).
        // Instead, stay in loading or just return?
        // If we return, the UI stays blank. 
        // Let's set verified=false BUT maybe show a clean error?
        // Handled by generic error boundary? No.
        setIsVerified(false);
        return;
      }

      if (user) {
        setUserId(user.id);

        // 1. CHECK DOCUMENTS / VERIFICATION
        // URGENT FREE MODE: Allow everyone. Ignore is_verified.
        /* 
        if (!user.is_verified) {
          setIsVerified(false);
          setDocumentsSubmitted(user.documents_submitted || false);
          return;
        } 
        */

        // 2. CHECK SUBSCRIPTION (New Logic)
        // If subscription_end_date is null OR in the past, they are NOT verified (payment needed).
        // Since the Admin "Verify" button sets this date, if it's missing, they aren't fully active.
        const now = new Date();
        const subEnd = user.subscription_end_date ? new Date(user.subscription_end_date) : null;

        if (subEnd && subEnd < new Date()) {
          console.log("Subscription expired:", user.subscription_end_date);

          // FREE MODE ENABLED: Do not block.
          // toast({
          //   title: "انتهى الاشتراك ⏳",
          //   description: "يرجى الاتصال بالإدارة لتجديد اشتراكك الشهري.",
          //   variant: "destructive",
          //   duration: 6000
          // });

          // setIsVerified(false);
          // return;

          console.log("Allowing access despite expiry (Free Mode)");
        }

        // If subEnd is null (New Driver) OR future (Paid Driver) -> Allow.
        setIsVerified(true);
        setIsOnline(user.is_online || false);
      }
    } catch (error: any) {
      // ... existing catch
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

      // Update User Profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          driving_license_url: licenseUrl,
          carte_grise_url: carteGriseUrl,
          documents_submitted: true
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      setDocumentsSubmitted(true);
      toast({
        title: "Documents Sent! 📄✅",
        description: "Your account is now under review. Please wait for approval.",
      });

    } catch (error: any) {
      console.error("Upload error:", error);
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
        {!driverLocation ? (
          <div className="flex flex-col items-center justify-center h-full bg-[#1A1A1A] text-white">
            <Loader2 className="w-12 h-12 text-[#84cc16] animate-spin mb-4" />
            <h2 className="text-xl font-bold">جاري تحديد الموقع...</h2>
            <p className="text-gray-400">يرجى الانتظار حتى يتم التقاط إشارة GPS</p>
          </div>
        ) : (
          <Map
            center={driverLocation}
            recenterKey={locationKey}
            markers={[
              {
                position: driverLocation,
                popup: "موقعي الحالي",
                icon: "🚗",
                rotation: driverHeading
              },
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
        )}
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
