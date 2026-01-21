import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DriverInfoCardProps {
  driver: {
    full_name: string;
    phone: string;
    rating: number;
    total_rides?: number;
    profile_image?: string;
  };
}

const DriverInfoCard = ({ driver }: DriverInfoCardProps) => {
  const handleCall = () => {
    window.location.href = `tel:${driver.phone}`;
  };

  return (
    <div className="flex items-center justify-between p-3 bg-card/50 rounded-xl border border-border/30" dir="rtl">
      <div className="flex items-center gap-3">
        <Avatar className="w-14 h-14 border-2 border-primary">
          <AvatarImage src={driver.profile_image} alt={driver.full_name} />
          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
            {driver.full_name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex flex-col">
          <h3 className="font-bold text-base text-foreground">{driver.full_name}</h3>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="font-bold text-yellow-500">{driver.rating.toFixed(1)}</span>
            {driver.total_rides && (
              <span className="text-muted-foreground text-sm">– {driver.total_rides} تقييم</span>
            )}
          </div>
        </div>
      </div>

      <Button
        onClick={handleCall}
        size="icon"
        className="w-12 h-12 rounded-full bg-primary hover:bg-primary/90"
      >
        <Phone className="w-5 h-5" />
      </Button>
    </div>
  );
};

export default DriverInfoCard;
