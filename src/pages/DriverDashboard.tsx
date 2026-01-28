
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import Map from "@/components/Map";
import RideRequestMap from "@/components/RideRequestMap";
import RideRequestCard from "@/components/RideRequestCard";
import ActiveRideCard from "@/components/ActiveRideCard";
import RatingDialog from "@/components/RatingDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Car, Navigation, LogOut, Power, CheckCircle, Clock, MapPin, User, Loader2, Phone, ShieldCheck, Menu, History, UserCircle, CreditCard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { playSound } from "@/utils/audio"; // Audio Utility import

const DriverDashboard = () => {
  const { t } = useTranslation();
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

  // SOUND EFFECT: Ring when Pending Ride exists
  useEffect(() => {
    let audio: HTMLAudioElement | null = null;
    if (pendingRide && !currentRide) {
      console.log("🔔 Ringing sound started...");
      audio = playSound('ring');
    }
    return () => {
      if (audio) {
        console.log("🔕 Ringing sound stopped.");
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }, [pendingRide, currentRide]);

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

        // Fetch customer info for this active ride with REAL rating
        if (activeRide.customer_id) {
          const { data: customerData } = await supabase
            .from('users')
            .select('id, full_name, phone, rating, total_rides, profile_image')
            .eq('id', activeRide.customer_id)
            .single();

          if (customerData) {
            // Fetch REAL average rating from reviews table for this CUSTOMER
            const { data: reviews } = await supabase
              .from('reviews')
              .select('rating')
              .eq('reviewee_id', customerData.id);

            let calculatedRating = 5.0;
            if (reviews && reviews.length > 0) {
              const total = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
              calculatedRating = total / reviews.length;
            }

            setCustomerInfo({
              ...customerData,
              rating: calculatedRating
            });
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

            // Fetch customer info with REAL rating calc
            const { data: customerData } = await supabase
              .from('users')
              .select('id, full_name, phone, rating, total_rides, profile_image')
              .eq('id', closestRide.customer_id)
              .single();

            if (customerData) {
              // Fetch REAL average rating from reviews table for this CUSTOMER
              const { data: reviews } = await supabase
                .from('reviews')
                .select('rating')
                .eq('reviewee_id', customerData.id);

              let calculatedRating = 5.0;
              if (reviews && reviews.length > 0) {
                const total = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
                calculatedRating = total / reviews.length;
              }

              setCustomerInfo({
                ...customerData,
                rating: calculatedRating // Override with real calculation
              });
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/driver/auth");
        return;
      }

      // 1. Resolve User ID (Table ID) from Auth ID (Session ID)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();

      if (userError || !userData) {
        console.error("User ID Resolution Failed:", userError);
        return;
      }

      // 2. CALL THE JUDGE! ⚖️
      const { data: status, error: judgeError } = await supabase.rpc('get_driver_status', {
        driver_id: userData.id // Pass the TABLE ID, not the Auth ID
      });

      if (judgeError) {
        console.error("Judge Error:", judgeError);
        return;
      }

      console.log("DRIVER STATUS (THE JUDGE):", status);

      // 2. EXECUTE THE VERDICT
      switch (status) {
        case 'active':
          setIsVerified(true);
          setIsSubscriptionExpired(false);
          // Restore online state from profile if needed, or query users table separately
          // For now, let's just ensure they are allowed in.
          break;

        case 'suspended':
          // Show Red Screen (Blocked)
          setIsSubscriptionExpired(true);
          // You might want to add a specific 'isSuspended' state for a custom message later
          break;

        case 'upload_documents':
          // Show Upload UI
          setIsVerified(false);
          setDocumentsSubmitted(false);
          break;

        case 'pending_approval':
          // Show Waiting UI
          setIsVerified(false);
          setDocumentsSubmitted(true);
          break;

        case 'payment_required':
          // Show Payment Screen
          setIsSubscriptionExpired(true);
          break;

        default:
          // Safety Fallback
          setIsVerified(false);
      }

      // Fetch user data just for basic info (Name, Online status) 
      // This is now secondary to the status check.
      const { data: user } = await supabase
        .from('users')
        .select('is_online, id')
        .eq('auth_id', session.user.id)
        .single();

      if (user) {
        setUserId(user.id);
        setIsOnline(user.is_online || false);
      }

    } catch (error) {
      console.error("Auth Check Failed:", error);
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

  // Ensure we check for 'pending_approval' status equivalent on load even if 'The Judge' returns something else (though judge handles it).
  // The Judge returns 'pending_approval' if docs are submitted but not verified.
  // So 'upload_documents' is ONLY returned if docs are NOT submitted.

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
      // Update User Profile via RPC (Secure & Atomic)
      const { error: updateError } = await supabase.rpc('submit_driver_documents', {
        p_license_url: licenseUrl,
        p_carte_grise_url: carteGriseUrl
      });

      if (updateError) {
        console.error("Database Update Error:", updateError);
        throw updateError;
      }

      // Force local state update IMMEDIATELY
      setDocumentsSubmitted(true);

      // Re-run Check Auth to verify 'The Judge' agrees
      setTimeout(() => {
        checkAuth();
      }, 1000);

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

  /*
     UPDATED FOR BIDDING SYSTEM:
     Drivers now SEND OFFERS instead of instantly accepting.
     HYBRID: If is_bidding is false, we Accept Instantly.
  */
  const handleSendOffer = async (price: number) => {
    if (!pendingRide || !userId) return;

    // HYBRID LOGIC: Standard Ride Check
    // We check if the ride is explicitly NOT a bidding ride
    if ((pendingRide as any).is_bidding === false) {
      await handleInstantAccept();
      return;
    }

    try {
      setLoading(true);

      // Insert Offer
      const { error } = await supabase.from('ride_offers').insert({
        ride_id: pendingRide.id,
        driver_id: userId,
        amount: price,
        status: 'pending'
      });

      if (error) throw error;

      toast({
        title: "تم إرسال العرض! 📤",
        description: `بانتظار موافقة العميل على ${price} دج`,
      });

      // Hide this request locally as "Responded"
      setIgnoredRideIds(prev => [...prev, pendingRide.id]);
      setPendingRide(null);
      setIsSheetExpanded(false);

    } catch (error: any) {
      console.error('Error sending offer:', error);
      toast({
        title: "خطأ",
        description: "فشل إرسال العرض",
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

    toast({ title: "تم تجاهل الطلب" });
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

      // KEY FIX: Clear current ride state IMMEDIATELY so the card vanishes
      // We rely on 'showRating' to keep the rating dialog open
      setCurrentRide(null);
      setCustomerLocation(null);
      setDestinationLocation(null);

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
      <header className="fixed top-0 left-0 right-0 z-[3000] p-4 flex justify-between items-start pointer-events-none">
        {/* Logo/Status Box */}
        <div className="bg-card/90 backdrop-blur border border-border rounded-full p-2 pr-4 pl-2 flex items-center gap-3 shadow-lg pointer-events-auto">
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
        <div className="flex gap-2 pointer-events-auto">
          {/* Online Toggle (Kept outside for quick access) */}
          <Button
            size="icon"
            onClick={toggleOnline}
            className={cn(
              "rounded-full w-12 h-12 transition-all duration-300 shadow-lg border border-white/10 backdrop-blur-md mr-2",
              isOnline
                ? "bg-black/60 text-[#84cc16] hover:bg-black/70 shadow-[0_0_15px_rgba(132,204,22,0.3)]"
                : "bg-black/60 text-red-500 hover:bg-black/70"
            )}
          >
            <Power className="w-6 h-6 fill-current" />
          </Button>

          {/* Sidebar Menu */}
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
                  onClick={() => navigate("/driver/profile")}
                >
                  <UserCircle className="w-6 h-6" />
                  {t('sidebar.profile')}
                </Button>

                <Button
                  variant="ghost"
                  className="justify-start gap-4 h-14 text-lg hover:bg-white/5 hover:text-[#84cc16] transition-colors"
                  onClick={() => navigate("/driver/financials")}
                >
                  <CreditCard className="w-6 h-6" />
                  {t('sidebar.financials')}
                </Button>

                <Button
                  variant="ghost"
                  className="justify-start gap-4 h-14 text-lg hover:bg-white/5 hover:text-[#84cc16] transition-colors"
                  onClick={() => navigate("/driver/history")}
                >
                  <History className="w-6 h-6" />
                  {t('sidebar.history')}
                </Button>

                <Button
                  variant="ghost"
                  className="justify-start gap-4 h-14 text-lg hover:bg-white/5 hover:text-[#84cc16] transition-colors"
                  onClick={() => navigate("/settings")}
                >
                  <Settings className="w-6 h-6" />
                  {t('sidebar.settings')}
                </Button>

                <div className="h-px bg-white/10 my-4"></div>

                <div className="px-2 text-xs text-gray-500 font-medium font-mono text-center opacity-50 pt-2">
                  {t('sidebar.version')} 1.0.0
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* --- Map Layer --- */}
      {/* --- Map Layer --- */}
      <div className="absolute inset-0 z-0">
        {pendingRide ? (
          <RideRequestMap
            driverLocation={driverLocation}
            pickupLocation={[pendingRide.pickup_lat, pendingRide.pickup_lng]}
            dropoffLocation={[pendingRide.destination_lat, pendingRide.destination_lng]}
          />
        ) : (
          <Map
            center={driverLocation || [36.7538, 3.0588]}
            recenterKey={locationKey}
            markers={[
              ...(driverLocation ? [{
                position: driverLocation,
                popup: "موقعي الحالي",
                icon: "🚗",
                rotation: driverHeading
              }] : []),
              ...(customerLocation && currentRide?.status === 'accepted' ? [
                { position: customerLocation, popup: "موقع العميل 📍", icon: "🧍" },
                ...(destinationLocation ? [{ position: destinationLocation, popup: "الوجهة (Dropoff) 🎯", icon: "pin" }] : [])
              ] as any[] : []),
              ...(currentRide?.status === 'in_progress' ? [
                ...(customerLocation ? [{ position: customerLocation, popup: "نقطة الانطلاق 📍", icon: "🧍" }] : []),
                ...(destinationLocation ? [{ position: destinationLocation, popup: "الوجهة 🎯", icon: "📍" }] : [])
              ] as any[] : [])
            ]}
            route={
              currentRide && driverLocation
                ? [
                  driverLocation,
                  currentRide.status === 'accepted'
                    ? [currentRide.pickup_lat, currentRide.pickup_lng]
                    : [currentRide.destination_lat, currentRide.destination_lng]
                ]
                : undefined
            }
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
      {pendingRide && (
        <RideRequestCard
          ride={pendingRide}
          customer={customerInfo}
          onAccept={handleSendOffer}
          onReject={handleRejectRide}
        />
      )}

      {/* --- Active Ride Info (Accepted/In Progress) --- */}
      {/* --- Active Ride Info (Accepted/In Progress) --- */}
      {/* --- Active Ride Info (Accepted/In Progress) --- */}
      {currentRide && !showRating && (
        <ActiveRideCard
          currentRide={currentRide}
          customerInfo={customerInfo}
          driverLocation={driverLocation}
          onCompleteRide={handleCompleteRide}
          onCallCustomer={() => window.location.href = `tel:${customerInfo?.phone}`}
        />
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
