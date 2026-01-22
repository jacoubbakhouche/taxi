import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, MessageSquare, Car, ChevronRight, X, CheckSquare, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
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

  const handleCall = () => {
    window.location.href = `tel:${driver.phone}`;
  };

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[2000] bg-[#1A1A1A] text-white rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.7)] border-t border-white/5 transition-all duration-300 ease-in-out",
        isExpanded ? "p-6 pb-8" : "p-4 pb-6"
      )}
    >

      {/* Handle Bar (Toggle) */}
      <div
        className="w-full flex justify-center py-5 cursor-pointer hover:opacity-80 active:scale-95 transition-transform"
        onClick={handleToggle}
      >
        <div className="w-12 h-1.5 bg-gray-700 rounded-full opacity-50"></div>
      </div>

      {/* Collapsed View (Minimal) */}
      {!isExpanded && (
        <div className="flex items-center justify-between px-2 animate-in fade-in">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border border-white/10">
              <AvatarImage src={driver.profile_image} />
              <AvatarFallback>{driver.full_name[0]}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-bold text-sm">{driver.full_name}</h3>
              <p className="text-[10px] text-gray-400">{driver.car_model} • {driver.license_plate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="w-8 h-8 rounded-full bg-[#84cc16] text-black hover:bg-[#65a30d]"
              onClick={(e) => { e.stopPropagation(); handleCall(); }}
            >
              <Phone className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleToggle}>
              <ChevronUp className="w-5 h-5 text-gray-400" />
            </Button>
          </div>
        </div>
      )}

      {/* Expanded View (Full) */}
      {isExpanded && (
        <div className="animate-in slide-in-from-bottom-5 fade-in duration-300">
          {/* Header: ETA & Car */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-xl font-bold mb-1 tracking-tight">
                {rideStatus === 'in_progress' ? "Ride in Progress" : "Driver is arriving in ~4 min"}
              </h2>
              <p className="text-gray-400 text-sm font-medium">{driver.car_model || "سيارة أجرة (Taxi)"}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button variant="ghost" size="icon" onClick={handleToggle} className="-mr-2 -mt-2">
                <ChevronDown className="w-6 h-6 text-gray-400" />
              </Button>
              <div className="flex items-center gap-2">
                <Car className="w-10 h-6 text-white/80" />
                <div className="bg-white/10 px-2 py-1 rounded text-[10px] font-mono tracking-widest border border-white/10">
                  {driver.license_plate || "00186.110.24"}
                </div>
              </div>
            </div>
          </div>

          {/* Actions Row */}
          <div className="flex justify-evenly items-center px-4 mb-8">
            {/* Driver Profile */}
            <div
              className="flex flex-col items-center gap-2 cursor-pointer group"
              onClick={() => navigate(`/customer/driver/${driver.id}`)}
            >
              <div className="relative">
                <Avatar className="w-16 h-16 border-2 border-white/10 group-hover:border-[#F5D848] transition-colors">
                  <AvatarImage src={driver.profile_image} className="object-cover" />
                  <AvatarFallback className="bg-gray-800 text-lg">{driver.full_name[0]}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-white text-black text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 shadow-lg">
                  <span>★</span> {driver.rating?.toFixed(1) || "5.0"}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">
                  {driver.full_name.split(' ')[0]}
                </span>
                <span className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors">
                  ({driver.total_rides || 0} رحلة)
                </span>
              </div>
            </div>

            {/* Contact */}
            <div className="flex flex-col items-center gap-2" onClick={handleCall}>
              <div className="w-16 h-16 rounded-full bg-[#84cc16] flex items-center justify-center text-black hover:bg-[#65a30d] transition-colors cursor-pointer shadow-lg shadow-[#84cc16]/20">
                <Phone className="w-7 h-7" />
              </div>
              <span className="text-xs font-semibold text-gray-300">Contact</span>
            </div>

            {/* Cancel / End Ride Button */}
            {rideStatus === 'in_progress' ? (
              <div className="flex flex-col items-center gap-2" onClick={onEndRide}>
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all cursor-pointer">
                  <CheckSquare className="w-7 h-7" />
                </div>
                <span className="text-xs font-semibold text-red-400">End Ride</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2" onClick={onCancel}>
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-red-500/20 hover:text-red-500 transition-colors cursor-pointer border border-white/5">
                  <X className="w-7 h-7" />
                </div>
                <span className="text-xs font-semibold text-gray-300">Cancel</span>
              </div>
            )}
          </div>

          {/* Note Input */}
          <div className="bg-white/5 rounded-2xl p-4 flex items-center gap-4 mb-6 cursor-pointer hover:bg-white/10 transition-colors border border-white/5">
            <MessageSquare className="w-5 h-5 text-gray-400" />
            <span className="text-gray-400 text-sm flex-1 font-medium">Any pickup notes for driver?</span>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </div>

          {/* Footer Info */}
          <div className="flex items-center gap-4 pt-4 border-t border-white/10">
            <div className="bg-[#4CAF50] px-2 py-1 rounded text-black text-xs font-bold">
              CASH
            </div>
            <p className="text-white font-bold text-lg">321 دج</p>
            <div className="flex-1"></div>

            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-xs text-gray-400">Current Ride</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs text-gray-400">Destination</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverInfoCard;
