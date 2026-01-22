import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Star, Car, Award } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DriverData {
    full_name: string;
    rating: number;
    total_rides: number;
    profile_image?: string;
    car_model?: string;
    license_plate?: string;
    created_at: string;
}

const DriverProfileView = () => {
    const navigate = useNavigate();
    const { driverId } = useParams();
    const [driver, setDriver] = useState<DriverData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDriverData();
    }, [driverId]);

    const fetchDriverData = async () => {
        try {
            setLoading(true);

            const { data: driverData, error } = await supabase
                .from('users')
                .select('full_name, rating, profile_image, created_at')
                .eq('id', driverId)
                .eq('role', 'driver')
                .single();

            if (error) throw error;

            // Fetch actual ride count
            const { count, error: countError } = await supabase
                .from('rides')
                .select('*', { count: 'exact', head: true })
                .eq('driver_id', driverId)
                .eq('status', 'completed');

            if (countError) throw countError;

            setDriver({
                ...driverData,
                total_rides: count || 0
            });

        } catch (error) {
            console.error('Error fetching driver data:', error);
            toast({
                title: "خطأ",
                description: "لم نتمكن من جلب بيانات السائق",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <p className="text-muted-foreground">جاري التحميل...</p>
            </div>
        );
    }

    if (!driver) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <p className="text-muted-foreground">لم يتم العثور على السائق</p>
            </div>
        );
    }

    // Calculate join date
    const joinDate = new Date(driver.created_at).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long' });

    return (
        <div className="min-h-screen bg-background" dir="rtl">
            <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ArrowRight className="w-5 h-5" />
                </Button>
                <h1 className="font-bold text-lg">ملف السائق</h1>
            </header>

            <div className="p-4 space-y-4">
                <Card className="p-6">
                    <div className="flex flex-col items-center gap-4">
                        <Avatar className="w-24 h-24 border-4 border-primary">
                            <AvatarImage src={driver.profile_image} alt={driver.full_name} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                                {driver.full_name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>

                        <div className="text-center">
                            <h2 className="font-bold text-2xl">{driver.full_name}</h2>
                            <div className="flex items-center justify-center gap-1 mt-2">
                                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                                <span className="font-bold text-xl text-yellow-600">
                                    {driver.rating.toFixed(1)}
                                </span>
                                <span className="text-sm text-muted-foreground mx-1">
                                    ({driver.total_rides} رحلة ناجحة)
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full mt-4">
                            <div className="bg-muted rounded-lg p-3 text-center">
                                <Car className="w-5 h-5 mx-auto text-primary mb-1" />
                                <p className="font-bold truncate">{driver.car_model || 'سيارة'}</p>
                                <p className="text-xs text-muted-foreground">{driver.license_plate}</p>
                            </div>
                            <div className="bg-muted rounded-lg p-3 text-center">
                                <Award className="w-5 h-5 mx-auto text-primary mb-1" />
                                <p className="font-bold">{joinDate}</p>
                                <p className="text-xs text-muted-foreground">انضم منذ</p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Placeholder for future reviews or badges */}
                <div className="text-center text-sm text-muted-foreground mt-8">
                    <p>السائق معتمد وموثوق</p>
                </div>
            </div>
        </div>
    );
};

export default DriverProfileView;
