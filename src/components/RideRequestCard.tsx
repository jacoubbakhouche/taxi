import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Clock, Banknote, User } from "lucide-react";

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
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const RideRequestCard = ({
  ride,
  customer,
  onAccept,
  onReject,
  loading,
}: RideRequestCardProps) => {

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[3000] bg-[#1A1A1A] text-white rounded-t-[2rem] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 animate-in slide-in-from-bottom-full duration-500">

      {/* Header Badge */}
      <div className="flex justify-center -mt-2 mb-6">
        <div className="h-1.5 w-12 bg-gray-700 rounded-full"></div>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#84cc16] text-black px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse">
              NEW REQUEST
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white">
            Someone needs a ride
          </h2>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-[#84cc16]">{Math.round(ride.price)} <span className="text-sm text-gray-400">DA</span></p>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">CASH TRIP</p>
        </div>
      </div>

      {/* Customer Preview */}
      <div className="flex items-center gap-4 mb-6 bg-white/5 p-4 rounded-2xl border border-white/5">
        <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden border-2 border-white/10 flex items-center justify-center">
          {customer?.profile_image ? (
            <img src={customer.profile_image} className="w-full h-full object-cover" />
          ) : (
            <User className="text-gray-400" />
          )}
        </div>
        <div>
          <h3 className="font-bold text-white text-lg">{customer?.full_name || "Passenger"}</h3>
          <div className="flex items-center gap-1 text-xs text-lime-500">
            <span>★</span> {customer?.rating?.toFixed(1) || "5.0"} ({customer?.total_rides || 0} rides)
          </div>
        </div>
      </div>

      {/* Route Details */}
      <div className="space-y-6 mb-8 relative">
        {/* Connector Line */}
        <div className="absolute top-3 bottom-8 right-[1.15rem] w-0.5 bg-gray-700 rounded-full" dir="rtl"></div>

        <div className="flex items-start gap-4 relative z-10" dir="rtl">
          <div className="mt-1">
            <div className="w-3 h-3 rounded-full bg-[#3B82F6] shadow-[0_0_10px_#3B82F6]"></div>
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">PICKUP</p>
            <p className="text-white font-medium text-lg leading-tight">{ride.pickup_address || "Current Location"}</p>
          </div>
        </div>

        <div className="flex items-start gap-4 relative z-10" dir="rtl">
          <div className="mt-1">
            <div className="w-3 h-3 rounded-full bg-[#84cc16] shadow-[0_0_10px_#84cc16]"></div>
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">DROPOFF</p>
            <p className="text-white font-medium text-lg leading-tight">{ride.destination_address || "Destination"}</p>
          </div>
        </div>
      </div>

      {/* Stat Badges */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center border border-white/5">
          <div className="flex items-center gap-2 mb-1 text-gray-400">
            <Navigation className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Distance</span>
          </div>
          <span className="text-xl font-bold text-white">{ride.distance?.toFixed(1)} km</span>
        </div>
        <div className="bg-white/5 rounded-xl p-3 flex flex-col items-center justify-center border border-white/5">
          <div className="flex items-center gap-2 mb-1 text-gray-400">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Time</span>
          </div>
          <span className="text-xl font-bold text-white">{ride.duration?.toFixed(0)} min</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={onReject}
          disabled={loading}
          variant="secondary"
          className="w-16 h-16 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10"
        >
          <span className="text-2xl">✕</span>
        </Button>

        <Button
          onClick={() => onAccept(Math.round(ride.price))}
          disabled={loading}
          className="flex-1 h-16 rounded-2xl bg-[#84cc16] hover:bg-[#E5C838] text-black text-xl font-bold shadow-[0_0_20px_rgba(245,216,72,0.3)] transition-all hover:scale-[1.02]"
        >
          ACCEPT ({Math.round(ride.price)} DA)
        </Button>
      </div>
    </div>
  );
};

export default RideRequestCard;
