import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, MapPin, Navigation, Clock, Star, Coins, ArrowRight, X, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";

interface RideRequestCardProps {
  ride: {
    id: string;
    pickup_address: string;
    destination_address: string;
    price: number;
    distance: number;
    duration: number;
    customer_offer_price?: number;
    status?: string;
  };
  customer: {
    full_name: string;
    profile_image: string | null;
    rating: number;
    total_rides: number;
    phone?: string;
  };
  onAccept: (price: number) => void;
  onReject: () => void;
}

const RideRequestCard = ({ ride, customer, onAccept, onReject }: RideRequestCardProps) => {
  const [counterPrice, setCounterPrice] = useState<string>("");
  const [isCountering, setIsCountering] = useState(false);

  // Initial offer is either what customer typed or the calc price
  const displayedPrice = ride.customer_offer_price || ride.price;

  const handleAccept = () => {
    onAccept(displayedPrice);
  };

  const handleCounterSubmit = () => {
    const amount = parseFloat(counterPrice);
    if (!amount || amount <= 0) return;
    onAccept(amount);
  };

  if (isCountering) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[2000] p-4 animate-in slide-in-from-bottom-10">
        <Card className="bg-[#1A1A1A] border-white/10 text-white p-6 shadow-2xl rounded-3xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">تقديم عرض مضاد</h3>
            <Button variant="ghost" size="icon" onClick={() => setIsCountering(false)}><X className="w-5 h-5" /></Button>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Input
                type="number"
                value={counterPrice}
                onChange={(e) => setCounterPrice(e.target.value)}
                placeholder={displayedPrice.toString()}
                className="h-14 text-center text-2xl font-bold bg-black/50 border-white/20 text-white placeholder:text-gray-600"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">دج</span>
            </div>

            <div className="flex gap-2">
              {[50, 100, 200].map(amt => (
                <Button
                  key={amt}
                  variant="outline"
                  className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  onClick={() => setCounterPrice((displayedPrice + amt).toString())}
                >
                  +{amt}
                </Button>
              ))}
            </div>

            <Button
              className="w-full h-12 bg-[#84cc16] hover:bg-[#65a30d] text-black font-bold text-lg mt-2"
              onClick={handleCounterSubmit}
            >
              إرسال العرض ({counterPrice || displayedPrice} دج)
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[2000] p-4">
      <Card className="bg-[#1A1A1A] border-white/10 text-white p-5 shadow-2xl rounded-3xl animate-in slide-in-from-bottom-5">

        {/* Customer Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 border border-white/10">
              <AvatarImage src={customer.profile_image || undefined} />
              <AvatarFallback><User className="w-6 h-6" /></AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-bold text-lg">{customer.full_name}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex items-center text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  {customer.rating.toFixed(1)}
                </div>
                <span>• {customer.total_rides} رحلة</span>
              </div>
            </div>
          </div>

          <div className="text-left">
            <h2 className="text-3xl font-bold text-[#84cc16]">{Math.round(displayedPrice)} <span className="text-sm text-gray-500 font-normal">دج</span></h2>
            {ride.customer_offer_price && ride.customer_offer_price !== ride.price && (
              <p className="text-xs text-orange-400">عرض العميل</p>
            )}
          </div>
        </div>

        {/* Route Info */}
        <div className="space-y-3 relative mb-6">
          {/* Connecting Line */}
          <div className="absolute right-[11px] top-6 bottom-6 w-0.5 bg-gray-700"></div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-[#84cc16]/20 flex items-center justify-center shrink-0 z-10">
              <div className="w-2.5 h-2.5 rounded-full bg-[#84cc16]"></div>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-0.5">من</p>
              <p className="font-medium text-sm line-clamp-1">{ride.pickup_address}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 z-10">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-0.5">إلى</p>
              <p className="font-medium text-sm line-clamp-1">{ride.destination_address}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-between items-center text-xs text-gray-400 bg-white/5 p-3 rounded-xl mb-4">
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-[#84cc16]" />
            <span>دفع نقدي</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Navigation className="w-4 h-4 text-blue-400" />
            <span>{ride.distance.toFixed(1)} كم</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-orange-400" />
            <span>{Math.ceil(ride.duration)} دقيقة</span>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12 bg-transparent border-white/20 text-white hover:bg-white/10"
            onClick={() => setIsCountering(true)}
          >
            اقتراح سعر
          </Button>

          <Button
            className="h-12 bg-[#84cc16] hover:bg-[#65a30d] text-black font-bold text-lg shadow-[0_0_20px_rgba(132,204,22,0.3)] animate-pulse"
            onClick={handleAccept}
          >
            قبول {Math.round(displayedPrice)} دج
          </Button>

          <Button
            variant="ghost"
            className="col-span-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 h-10 w-full"
            onClick={onReject}
          >
            تجاهل الطلب
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default RideRequestCard;
