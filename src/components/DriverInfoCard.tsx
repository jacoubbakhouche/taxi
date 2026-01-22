import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, MessageSquare, Car, ChevronRight, X, CheckSquare, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

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
  };
  rideStatus?: string; // accepted, in_progress
  onCancel?: () => void;
  onEndRide?: () => void;
}

const DriverInfoCard = ({ driver, rideStatus = 'accepted', onCancel, onEndRide }: DriverInfoCardProps) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

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
            <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
              <Car className="w-4 h-4" />
              <span>{driver.car_model || "سيارة أجرة"}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="bg-[#F5D848] text-black px-3 py-1 rounded-lg text-sm font-bold tracking-widest border border-yellow-500/20 shadow-lg shadow-yellow-500/10">
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
              <Avatar className="w-16 h-16 border-2 border-white/10 group-hover:border-[#F5D848] transition-all duration-300">
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
          <div
            className="flex flex-col items-center gap-2 cursor-pointer flex-1"
            onClick={(e) => {
              e.stopPropagation();
              if (rideStatus === 'in_progress') onEndRide?.();
              else onCancel?.();
            }}
          >
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-95 transition-all",
              rideStatus === 'in_progress'
                ? "bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30"
                : "bg-gray-800 text-gray-400 border border-white/10 hover:bg-gray-700"
            )}>
              {rideStatus === 'in_progress' ? <CheckSquare className="w-6 h-6" /> : <X className="w-6 h-6" />}
            </div>
            <span className="text-xs text-gray-400 font-medium">
              {rideStatus === 'in_progress' ? "إنهاء" : "إلغاء"}
            </span>
          </div>
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
            <span className="text-white font-bold text-xl">321 دج</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DriverInfoCard;
