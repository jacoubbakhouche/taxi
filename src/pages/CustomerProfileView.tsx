import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Star, MapPin, Phone } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ProfileSkeleton } from "@/components/ProfileSkeleton";

interface CustomerData {
  full_name: string;
  phone: string;
  rating: number;
  total_rides: number;
  profile_image?: string;
}

interface RideHistory {
  id: string;
  pickup_address: string;
  destination_address: string;
  price: number;
  completed_at: string;
  rating: number;
}

const CustomerProfileView = () => {
  const navigate = useNavigate();
  const { customerId } = useParams();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [rideHistory, setRideHistory] = useState<RideHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerData();
  }, [customerId]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);

      // Fetch customer data
      const { data: customerData, error: customerError } = await supabase
        .from('users')
        .select('full_name, phone, rating, total_rides, profile_image')
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      // Fetch recent rides
      const { data: ridesData, error: ridesError } = await supabase
        .from('rides')
        .select('id, pickup_address, destination_address, price, completed_at, rating')
        .eq('customer_id', customerId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(5);

      if (ridesError) throw ridesError;
      setRideHistory(ridesData || []);
    } catch (error) {
      console.error('Error fetching customer data:', error);
      toast({
        title: "خطأ",
        description: "لم نتمكن من جلب بيانات العميل",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (customer?.phone) {
      window.location.href = `tel:${customer.phone}`;
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">لم يتم العثور على العميل</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-lg">ملف العميل</h1>
      </header>

      <div className="p-4 space-y-4">
        <Card className="p-6">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="w-24 h-24 border-4 border-primary">
              <AvatarImage src={customer.profile_image} alt={customer.full_name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                {customer.full_name.charAt(0)}
              </AvatarFallback>
            </Avatar>

            <div className="text-center">
              <h2 className="font-bold text-2xl">{customer.full_name}</h2>
              <div className="flex items-center justify-center gap-1 mt-2">
                <Star className="w-5 h-5 fill-lime-500 text-lime-500" />
                <span className="font-bold text-xl text-yellow-600">
                  {customer.rating.toFixed(1)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full mt-4">
              <div className="bg-muted rounded-lg p-3 text-center">
                <MapPin className="w-5 h-5 mx-auto text-primary mb-1" />
                <p className="text-2xl font-bold">{customer.total_rides}</p>
                <p className="text-sm text-muted-foreground">رحلة</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <Phone className="w-5 h-5 mx-auto text-primary mb-1" />
                <p className="text-sm font-medium">{customer.phone}</p>
                <p className="text-sm text-muted-foreground">الهاتف</p>
              </div>
            </div>

            <Button
              onClick={handleCall}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
            >
              <Phone className="w-4 h-4 ml-2" />
              اتصل بالعميل
            </Button>
          </div>
        </Card>

        {rideHistory.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-bold text-lg">آخر الرحلات</h3>
            {rideHistory.map((ride) => (
              <Card key={ride.id} className="p-4">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">من</p>
                      <p className="text-sm font-medium truncate">{ride.pickup_address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">إلى</p>
                      <p className="text-sm font-medium truncate">{ride.destination_address}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-primary">{ride.price.toFixed(2)} ريال</p>
                      {ride.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-lime-500 text-lime-500" />
                          <span className="text-sm">{ride.rating}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ride.completed_at).toLocaleDateString('ar-DZ')}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerProfileView;
