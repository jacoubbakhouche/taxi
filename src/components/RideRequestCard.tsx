import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Navigation, ChevronUp, ChevronDown, Plus, Minus } from "lucide-react";
import CustomerInfoCard from "./CustomerInfoCard";

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
  onCustomerClick,
  loading,
  isExpanded = true,
  onToggleExpand
}: RideRequestCardProps) => {
  const [bidAmount, setBidAmount] = useState<number>(ride.offered_price || ride.price);

  useEffect(() => {
    setBidAmount(ride.offered_price || ride.price);
  }, [ride]);

  const incrementBid = (amount: number) => {
    setBidAmount(prev => Math.floor(prev + amount));
  };

  const decrementBid = (amount: number) => {
    setBidAmount(prev => Math.max(0, Math.floor(prev - amount)));
  };

  return (
    <Card className="bg-card/95 backdrop-blur-sm border-2 border-primary/20 animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
      {/* Collapsed View */}
      {!isExpanded && (
        <div className="p-4" dir="rtl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              {customer && (
                <p className="font-bold text-sm truncate">{customer.full_name}</p>
              )}
              <p className="text-2xl font-bold text-primary">
                💰 {bidAmount.toFixed(0)} دج
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => onAccept(bidAmount)}
                disabled={loading}
                size="sm"
                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              >
                ✅
              </Button>
              <Button
                onClick={onReject}
                disabled={loading}
                size="sm"
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                ❌
              </Button>
            </div>
          </div>
          {onToggleExpand && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="w-full mt-2"
            >
              <ChevronUp className="w-4 h-4" />
              عرض التفاصيل
            </Button>
          )}
        </div>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <div className="p-4 space-y-4" dir="rtl">
          {onToggleExpand && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpand}
              className="w-full"
            >
              <ChevronDown className="w-4 h-4" />
              تصغير
            </Button>
          )}

          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">🚖 طلب جديد</h3>
              <p className="text-sm text-muted-foreground">عميل قريب منك</p>
            </div>
          </div>

          {customer && (
            <CustomerInfoCard
              customer={customer}
              onClick={onCustomerClick}
              showCallButton={true}
            />
          )}

          <div className="space-y-2 bg-muted/50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Navigation className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">من</p>
                <p className="text-sm font-medium">{ride.pickup_address}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">إلى</p>
                <p className="text-sm font-medium">{ride.destination_address}</p>
              </div>
            </div>
          </div>

          {/* Negotiate Price UI */}
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-3 border-2 border-primary/30 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold">سعر العرض (دج)</span>
              <span className="text-xs text-muted-foreground">عرض الراكب: {ride.offered_price || ride.price} دج</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => decrementBid(50)}
                className="h-10 w-10 shrink-0"
              >
                <Minus className="w-4 h-4" />
              </Button>

              <Input
                type="number"
                value={bidAmount}
                onChange={(e) => setBidAmount(Number(e.target.value))}
                className="text-center font-bold text-xl h-10 bg-background"
              />

              <Button
                size="icon"
                variant="outline"
                onClick={() => incrementBid(50)}
                className="h-10 w-10 shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 text-xs"
                onClick={() => incrementBid(50)}
              >
                +50
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 text-xs"
                onClick={() => incrementBid(100)}
              >
                +100
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 text-xs"
                onClick={() => incrementBid(200)}
              >
                +200
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">المسافة</p>
              <p className="text-lg font-bold text-primary">{ride.distance?.toFixed(1)} كم</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">المدة</p>
              <p className="text-lg font-bold text-primary">{ride.duration?.toFixed(0)} دقيقة</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => onAccept(bidAmount)}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-primary to-secondary hover:opacity-90 font-bold text-lg h-12"
            >
              إرسال العرض ({bidAmount} دج)
            </Button>
            <Button
              onClick={onReject}
              disabled={loading}
              variant="outline"
              className="w-16 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              ❌
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default RideRequestCard;
