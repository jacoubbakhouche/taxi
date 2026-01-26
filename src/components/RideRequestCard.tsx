import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Clock, User, Phone, ChevronUp } from "lucide-react";
import { motion, PanInfo, AnimatePresence } from "framer-motion";

interface RideRequestCardProps {
  ride: {
    id: string;
    pickup_address: string;
    destination_address: string;
    distance: number;
    duration: number;
    price: number;
    pickup_lat: number;
    pickup_lng: number;
    status?: 'pending' | 'negotiating' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
    offered_price?: number;
  };
  customer?: {
    id: string;
    full_name: string;
    phone?: string;
    rating: number;
    total_rides: number;
    profile_image?: string;
  };
  onAccept: (price: number) => void;
  onInstantAccept?: () => void;
  onReject: () => void;
  onCustomerClick?: () => void;
  loading?: boolean;
}

const RideRequestCard = ({
  ride,
  customer,
  onAccept,
  onReject,
  loading,
}: RideRequestCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleDragEnd = (_: any, info: PanInfo) => {
    // If dragged down significantly, collapse
    if (info.offset.y > 50 && isExpanded) {
      setIsExpanded(false);
    }
    // If dragged up, expand
    else if (info.offset.y < -50 && !isExpanded) {
      setIsExpanded(true);
    }
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (customer?.phone) {
      window.location.href = `tel:${customer.phone}`;
    }
  };

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      className="fixed bottom-0 left-0 right-0 z-[3000] bg-[#1A1A1A] text-white rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 overflow-hidden flex flex-col"
      style={{ touchAction: "none" }}
    >
      {/* Handle Bar Area */}
      <div
        className="w-full flex items-center justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors"
        onClick={toggleExpand}
      >
        <div className="h-1.5 w-12 bg-gray-600 rounded-full"></div>
      </div>

      <div className="px-6 pb-6 flex flex-col gap-4">

        {/* Header Row: Title & Price (Always Visible) */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-[#84cc16] text-black px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">
                NEW
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">Trip Request</h2>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#84cc16]">{Math.round(ride.price)} <span className="text-xs text-gray-400">DA</span></p>
          </div>
        </div>

        {/* Passenger Info Row (Always Visible) */}
        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
          <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden border-2 border-white/10 flex items-center justify-center shrink-0">
            {customer?.profile_image ? (
              <img src={customer.profile_image} className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-base truncate">{customer?.full_name || "Passenger"}</h3>
            <div className="flex items-center gap-1 text-xs text-lime-500">
              <span>★</span> {customer?.rating?.toFixed(1) || "5.0"} <span className="text-gray-500">({customer?.total_rides || 0} rides)</span>
            </div>
          </div>

          {/* Circular Call Button (Requested Feature 1) */}
          <Button
            size="icon"
            variant="outline"
            className="rounded-full w-10 h-10 border-[#84cc16] text-[#84cc16] hover:bg-[#84cc16] hover:text-black transition-colors"
            onClick={handleCall}
            disabled={!customer?.phone}
          >
            <Phone className="w-5 h-5" />
          </Button>
        </div>

        {/* Collapsible Details Content (Requested Feature 2) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="space-y-4 pt-2 pb-4">
                {/* Route Diagram */}
                <div className="relative pl-4 space-y-6">
                  {/* Vertical Line */}
                  <div className="absolute left-[21px] top-3 bottom-8 w-0.5 bg-gray-700 rounded-full"></div>

                  <div className="flex items-start gap-3 relative z-10">
                    <div className="mt-1 w-3 h-3 rounded-full bg-[#3B82F6] shadow-[0_0_8px_#3B82F6] shrink-0"></div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">PICKUP</p>
                      <p className="text-white text-sm font-medium leading-tight">{ride.pickup_address || "Current Location"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 relative z-10">
                    <div className="mt-1 w-3 h-3 rounded-full bg-[#84cc16] shadow-[0_0_8px_#84cc16] shrink-0"></div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">DROPOFF</p>
                      <p className="text-white text-sm font-medium leading-tight">{ride.destination_address || "Destination"}</p>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-2.5 flex flex-col items-center justify-center border border-white/5">
                    <div className="flex items-center gap-1.5 mb-0.5 text-gray-400">
                      <Navigation className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase">Dist</span>
                    </div>
                    <span className="text-base font-bold text-white">{ride.distance?.toFixed(1)} km</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5 flex flex-col items-center justify-center border border-white/5">
                    <div className="flex items-center gap-1.5 mb-0.5 text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase">Time</span>
                    </div>
                    <span className="text-base font-bold text-white">{ride.duration?.toFixed(0)} min</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Buttons (Always Visible) */}
        <div className="flex gap-3 mt-auto">
          <Button
            onClick={onReject}
            disabled={loading}
            variant="secondary"
            className="h-14 w-16 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 shrink-0"
          >
            <span className="text-xl">✕</span>
          </Button>

          <Button
            onClick={() => onAccept(Math.round(ride.price))}
            disabled={loading}
            className="flex-1 h-14 rounded-xl bg-[#84cc16] hover:bg-[#E5C838] text-black text-lg font-bold shadow-[0_0_20px_rgba(132,204,22,0.3)] transition-all active:scale-95"
          >
            ACCEPT ({Math.round(ride.price)})
          </Button>
        </div>

      </div>
    </motion.div>
  );
};

export default RideRequestCard;
