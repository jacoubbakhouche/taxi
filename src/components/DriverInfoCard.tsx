import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, MessageSquare, Car, ChevronRight, X, CheckSquare, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// Add to interface
interface DriverInfoCardProps {
  driver: {
    id: string;
    full_name: string;
    phone: string;
    rating: number;
    total_rides?: number;
    profile_image?: string;
    car_model?: string;
    license_plate?: string;
    vehicle_color?: string;
    vehicle_class?: string;
  };
  rideStatus?: string; // accepted, in_progress
  onCancel?: () => void;
  onEndRide?: () => void;
  price?: number;
  rideId?: string;
}

const DriverInfoCard = ({ driver, rideStatus = 'accepted', onCancel, onEndRide, price = 0, rideId }: DriverInfoCardProps) => {

  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const [displayPrice, setDisplayPrice] = useState(price);

  useEffect(() => {
    // 1. Initial Sync from Prop (if valid)
    if (price && price > 0) setDisplayPrice(price);

    // 2. Intelligent Fetch & Subscribe (The "Smart" Logic)
    if (rideId) {
      const fetchAndSubscribe = async () => {
        // A. Immediate Fetch
        const { data } = await supabase
          .from('rides')
          .select('final_price, price, customer_offer_price')
          .eq('id', rideId)
          .single();

        if (data) {
          // Priority: Final Deal > Main Price > Customer Offer
          const realPrice = data.final_price || data.price || data.customer_offer_price;
          if (realPrice) setDisplayPrice(realPrice);
        }

        // B. Realtime Subscription for Updates
        const channel = supabase
          .channel(`ride-price-${rideId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'rides',
              filter: `id=eq.${rideId}`,
            },
            (payload) => {
              const updated = payload.new;
              const newPrice = updated.final_price || updated.price || updated.customer_offer_price;
              if (newPrice) setDisplayPrice(newPrice);
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      };

      fetchAndSubscribe();
    }
  }, [rideId, price]);

  const handleCall = () => {
    if (driver.phone) window.location.href = `tel:${driver.phone}`;
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent bubbling
    setIsExpanded(!isExpanded);
  };

  // Ensure card is always visible above map
  return (
    <div
      ref={cardRef}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[2000] bg-[#1A1A1A] text-white rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.7)] border-t border-white/5 transition-transform duration-300 ease-in-out",
        isExpanded ? "translate-y-0" : "translate-y-[calc(100%-80px)]"
      )}
      style={{ willChange: 'transform' }}
    >
      {/* Handle Bar Area (Always visible) */}
      <div
        className="w-full flex justify-center pt-4 pb-2 cursor-pointer h-[30px]"
        onClick={handleToggle}
      >
        <div className="w-12 h-1.5 bg-gray-700 rounded-full opacity-50" />
      </div>

      {/* Main Content Area */}
      <div className="px-6 pb-8 overflow-y-auto max-h-[80vh] relative z-[2002]">

        {/* Header: Status & Car Info */}
        <div className="flex justify-between items-start mb-6">
          <div onClick={handleToggle} className="cursor-pointer">
            <h2 className="text-2xl font-bold mb-1 tracking-tight text-white">
              {rideStatus === 'in_progress' ? "رحلة جارية" : "السائق قبل الطلب"}
            </h2>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-white text-base font-medium">
                <Car className="w-5 h-5 text-[#84cc16]" />
                <span>{driver.car_model || "سيارة أجرة"}</span>
                <span className="text-gray-400 text-sm">({driver.vehicle_color || "Yellow"})</span>
              </div>
              {driver.vehicle_class && (
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded w-fit ${driver.vehicle_class === 'luxury' ? 'bg-[#84cc16] text-black' :
                  driver.vehicle_class === 'comfort' ? 'bg-blue-500 text-white' :
                    'bg-gray-700 text-gray-300'
                  }`}>
                  {driver.vehicle_class}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="bg-[#84cc16] text-black px-3 py-1 rounded-lg text-sm font-bold tracking-widest border border-lime-500/20 shadow-lg shadow-lime-500/10">
              {driver.license_plate || "TAXI"}
            </div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">License Plate</span>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex justify-between items-center px-2 mb-8 gap-4">
          {/* 1. Driver Profile & Stats */}
          <div
            className="flex flex-col items-center gap-2 cursor-pointer group flex-1"
            onClick={(e) => { e.stopPropagation(); navigate(`/customer/driver/${driver.id}`); }}
          >
            <div className="relative">
              <Avatar className="w-16 h-16 border-2 border-white/10 group-hover:border-[#84cc16] transition-all duration-300">
                <AvatarImage src={driver.profile_image} className="object-cover" />
                <AvatarFallback className="bg-gray-800 text-lg">{driver.full_name[0]}</AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 -right-1 bg-white text-black text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg flex items-center gap-1">
                <span>★</span> {driver.rating?.toFixed(1) || "5.0"}
              </div>
            </div>
            <div className="text-center mt-1">
              <p className="text-sm text-white font-bold">{driver.full_name.split(" ")[0]}</p>
              <p className="text-[10px] text-gray-400">{driver.total_rides || 0} رحلة مكتملة</p>
            </div>
          </div>

          {/* 2. Call Driver */}
          <div
            className="flex flex-col items-center gap-2 cursor-pointer flex-1"
            onClick={(e) => { e.stopPropagation(); handleCall(); }}
          >
            <div className="w-14 h-14 rounded-2xl bg-[#22c55e] flex items-center justify-center text-black hover:bg-[#16a34a] shadow-lg shadow-green-500/20 active:scale-95 transition-all">
              <Phone className="w-6 h-6" />
            </div>
            <span className="text-xs text-gray-400 font-medium">اتصال</span>
          </div>

          {/* 3. Action (Cancel) */}
          {/* 3. Action (Cancel) - Only visible if ride is NOT yet in progress */}
          {rideStatus !== 'in_progress' ? (
            <div
              className="flex flex-col items-center gap-2 cursor-pointer flex-1"
              onClick={(e) => {
                e.stopPropagation();
                onCancel?.();
              }}
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-95 transition-all bg-gray-800 text-gray-400 border border-white/10 hover:bg-gray-700">
                <X className="w-6 h-6" />
              </div>
              <span className="text-xs text-gray-400 font-medium">إلغاء</span>
            </div>
          ) : (
            // Empty placeholder to keep layout balanced/spaced if needed, or nothing.
            // Let's us nothing so Call/Profile center better or take space.
            <div className="flex-1"></div>
          )}
        </div>

        {/* Note Input Placeholder */}
        <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-4 mb-4 border border-white/5">
          <MessageSquare className="w-5 h-5 text-gray-500" />
          <span className="text-gray-500 text-sm">Send a note to driver...</span>
        </div>

        {/* Payment Info */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <span className="bg-green-500 text-black text-xs font-bold px-2 py-1 rounded">CASH</span>
            <span className="text-white font-bold text-xl">{displayPrice > 0 ? Math.round(displayPrice) : "---"} دج</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DriverInfoCard;
