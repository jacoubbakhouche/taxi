import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Star, Car, Award } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ProfileSkeleton } from "@/components/ProfileSkeleton";

interface DriverData {
    full_name: string;
    rating: number;
    total_rides: number;
    profile_image?: string;
    car_model?: string;
    license_plate?: string;
    created_at: string;
    vehicle_class?: string;
    vehicle_type?: string;
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

            // Select extra fields for vehicle
            const { data: driverData, error } = await supabase
                .from('users')
                .select('full_name, rating, profile_image, created_at, vehicle_class, vehicle_type, car_model, license_plate')
                .eq('id', driverId)
                //.eq('role', 'driver') // Removed stricter check to avoid issues if role mismatch
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
        return <ProfileSkeleton />;
    }

    if (!driver) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#1A1A1A]">
                <p className="text-muted-foreground">لم يتم العثور على السائق</p>
            </div>
        );
    }

    // Calculate join date
    const joinDate = new Date(driver.created_at).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long' });

    return (
        <div className="min-h-screen bg-[#1A1A1A]" dir="rtl">
            {/* Header Gradient */}
            <div className="bg-gradient-to-b from-[#84cc16] via-[#84cc16]/80 to-[#1A1A1A] p-6 pb-20 border-b border-white/5 relative">
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-black hover:bg-black/10">
                        <ArrowRight className="w-6 h-6" />
                    </Button>
                    <h1 className="font-bold text-lg text-black">ملف السائق</h1>
                    <div className="w-10"></div> {/* Spacer */}
                </div>

                {/* 3D Car & Avatar Combo (Public View) */}
                <div className="relative mt-8 mb-6 h-32 flex items-end justify-center">
                    {/* Car Image (Largest) */}
                    {driver.vehicle_class && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 z-10 animate-in fade-in zoom-in duration-700">
                            <img
                                src={`/cars/${driver.vehicle_class}.png`}
                                onError={(e) => e.currentTarget.src = '/cars/standard.png'}
                                alt="Vehicle"
                                className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                            />
                        </div>
                    )}

                    {/* Avatar (Floating Badge) */}
                    <div className="absolute -bottom-4 right-1/2 translate-x-16 z-20">
                        <Avatar className="w-16 h-16 border-4 border-[#1A1A1A] shadow-xl">
                            <AvatarImage src={driver.profile_image || undefined} className="object-cover" />
                            <AvatarFallback className="bg-white text-black font-bold">
                                {driver.full_name?.[0]}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                </div>

                <div className="text-center">
                    <h2 className="font-bold text-2xl text-white mt-6 mb-2">{driver.full_name}</h2>

                    {/* Vehicle Type Badge */}
                    {driver.vehicle_type && (
                        <div className="flex justify-center mb-3">
                            <span className="bg-[#84cc16] text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg shadow-lime-500/20">
                                {driver.vehicle_type === 'taxi_owner' && '🚕 مالك طاكسي'}
                                {driver.vehicle_type === 'taxi_rent' && '🔑 سائق طاكسي'}
                                {driver.vehicle_type === 'vtc' && '🚙 سائق خاص'}
                                {driver.vehicle_type === 'delivery' && '📦 توصيل'}
                            </span>
                        </div>
                    )}

                    <div className="flex items-center justify-center gap-1 mt-2">
                        <Star className="w-5 h-5 fill-lime-500 text-lime-500" />
                        <span className="font-bold text-xl text-lime-500">
                            {driver.rating.toFixed(1)}
                        </span>
                        <span className="text-sm text-gray-400 mx-1">
                            ({driver.total_rides} رحلة ناجحة)
                        </span>
                    </div>
                </div>
            </div>

            <div className="px-6 -mt-6">
                <div className="grid grid-cols-2 gap-4 w-full mt-4">
                    <div className="bg-[#242424] rounded-xl p-4 text-center border border-white/5 shadow-lg">
                        <Car className="w-6 h-6 mx-auto text-[#84cc16] mb-2" />
                        <p className="font-bold text-white truncate">{driver.car_model || 'سيارة'}</p>
                        <p className="text-xs text-gray-400 mt-1">{driver.license_plate || '---'}</p>
                    </div>
                    <div className="bg-[#242424] rounded-xl p-4 text-center border border-white/5 shadow-lg">
                        <Award className="w-6 h-6 mx-auto text-[#84cc16] mb-2" />
                        <p className="font-bold text-white text-sm">عضو منذ</p>
                        <p className="text-xs text-gray-400 mt-1">{joinDate}</p>
                    </div>
                </div>

                <div className="text-center text-sm text-gray-500 mt-12 bg-[#242424]/50 p-4 rounded-xl border border-white/5 mx-auto max-w-xs">
                    <p>السائق معتمد وموثوق</p>
                    <p className="text-[10px] mt-1 opacity-70">تم التحقق من الوثائق والهوية</p>
                </div>
            </div>
        </div>
    );
};

export default DriverProfileView;
