import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Star, History } from "lucide-react";
import { ProfileSkeleton } from "@/components/ProfileSkeleton";

interface Ride {
    id: string;
    pickup_address: string;
    destination_address: string;
    price: number;
    status: string;
    rating: number | null;
    created_at: string;
    completed_at: string | null;
    distance: number;
    duration: number;
    customer_id: string;
    final_price?: number;
}

const DriverHistory = () => {
    const navigate = useNavigate();
    const [rides, setRides] = useState<Ride[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadRides();
    }, []);

    const loadRides = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate("/driver/auth");
                return;
            }

            const { data: user } = await supabase
                .from("users")
                .select("id")
                .eq("auth_id", session.user.id)
                .single();

            if (!user) return;

            const { data, error } = await supabase
                .from("rides")
                .select("*")
                .eq("driver_id", user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setRides(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getRidesByStatus = (status: string[]) => {
        return rides.filter((ride) => status.includes(ride.status));
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("ar-DZ", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const RideCard = ({ ride }: { ride: Ride }) => (
        <Card className="p-4 space-y-3 bg-[#1A1A1A] border-white/5 text-white">
            <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1 text-right">
                    <div className="flex items-start gap-2 justify-end">
                        <div className="text-right">
                            <p className="text-sm text-gray-400">من</p>
                            <p className="font-medium text-white">{ride.pickup_address}</p>
                        </div>
                        <MapPin className="w-4 h-4 text-[#84cc16] mt-1 shrink-0" />
                    </div>
                    <div className="flex items-start gap-2 justify-end">
                        <div className="text-right">
                            <p className="text-sm text-gray-400">إلى</p>
                            <p className="font-medium text-white">{ride.destination_address}</p>
                        </div>
                        <MapPin className="w-4 h-4 text-red-500 mt-1 shrink-0" />
                    </div>
                </div>
                <div className="text-left pl-4 border-l border-white/10">
                    <p className="text-xl font-bold text-[#84cc16]">{ride.final_price || ride.price} دج</p>
                    <p className="text-xs text-gray-400">
                        {ride.distance?.toFixed(1)} كم
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <p className="text-xs text-gray-500">{formatDate(ride.created_at)}</p>
                {ride.rating && (
                    <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-lime-500 text-lime-500" />
                        <span className="text-sm font-medium">{ride.rating}</span>
                    </div>
                )}
            </div>
        </Card>
    );

    if (loading) {
        return <ProfileSkeleton />;
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            <div className="bg-[#1A1A1A] pb-8 pt-6 px-6 rounded-b-[2rem] shadow-2xl relative overflow-hidden mb-6">
                <div className="flex items-center justify-between relative z-10">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate("/driver/dashboard")}
                        className="text-white hover:bg-white/10 rounded-full"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        سجل الرحلات <History className="w-6 h-6 text-[#84cc16]" />
                    </h1>
                </div>
            </div>

            {/* Tabs */}
            <div className="px-4">
                <Tabs defaultValue="completed" className="w-full" dir="rtl">
                    <TabsList className="grid w-full grid-cols-3 bg-[#1A1A1A] text-gray-400">
                        <TabsTrigger value="completed" className="data-[state=active]:bg-[#84cc16] data-[state=active]:text-black">المكتملة</TabsTrigger>
                        <TabsTrigger value="cancelled" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">الملغاة</TabsTrigger>
                        <TabsTrigger value="rejected" className="data-[state=active]:bg-gray-700 data-[state=active]:text-white">المرفوضة</TabsTrigger>
                    </TabsList>

                    <TabsContent value="completed" className="space-y-3 mt-4">
                        {getRidesByStatus(["completed"]).length === 0 ? (
                            <div className="text-center py-10 text-gray-500">
                                <p>لا توجد رحلات مكتملة</p>
                            </div>
                        ) : (
                            getRidesByStatus(["completed"]).map((ride) => (
                                <RideCard key={ride.id} ride={ride} />
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="cancelled" className="space-y-3 mt-4">
                        {getRidesByStatus(["cancelled"]).length === 0 ? (
                            <div className="text-center py-10 text-gray-500">
                                <p>لا توجد رحلات ملغاة</p>
                            </div>
                        ) : (
                            getRidesByStatus(["cancelled"]).map((ride) => (
                                <RideCard key={ride.id} ride={ride} />
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="rejected" className="space-y-3 mt-4">
                        {/* "Rejected" usually implies offers rejected by driver? Or rides cancelled by driver? 
                 Usually 'rejected' isn't a final status in rides table unless we track it differently.
                 Assuming status 'rejected' exists or using 'cancelled' by driver logic.
                 For simplicity relying on status string.
             */}
                        {getRidesByStatus(["rejected"]).length === 0 ? (
                            <div className="text-center py-10 text-gray-500">
                                <p>لا توجد رحلات مرفوضة</p>
                            </div>
                        ) : (
                            getRidesByStatus(["rejected"]).map((ride) => (
                                <RideCard key={ride.id} ride={ride} />
                            ))
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default DriverHistory;
