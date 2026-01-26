import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Star } from "lucide-react";

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
}

const RideHistory = () => {
    const navigate = useNavigate();
    const [rides, setRides] = useState<Ride[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadRides();
    }, []);

    const loadRides = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: user } = await supabase
                .from("users")
                .select("id")
                .eq("auth_id", session.user.id)
                .single();

            if (!user) return;

            const { data, error } = await supabase
                .from("rides")
                .select("*")
                .eq("customer_id", user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setRides(data || []);
        } catch (error: any) {
            console.error("Error loading rides:", error);
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
        <Card className="p-4 space-y-3 bg-[#1A1A1A] border-white/10 text-white shadow-lg">
            <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                    <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-[#84cc16] mt-1 shrink-0" />
                        <div>
                            <p className="text-xs text-gray-400">من</p>
                            <p className="font-medium text-sm line-clamp-1">{ride.pickup_address}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-red-500 mt-1 shrink-0" />
                        <div>
                            <p className="text-xs text-gray-400">إلى</p>
                            <p className="font-medium text-sm line-clamp-1">{ride.destination_address}</p>
                        </div>
                    </div>
                </div>
                <div className="text-left bg-white/5 p-2 rounded-lg">
                    <p className="text-lg font-bold text-[#84cc16]">{Math.round(ride.price)} دج</p>
                    <p className="text-[10px] text-gray-400">
                        {ride.distance?.toFixed(1)} كم
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <p className="text-xs text-gray-500">{formatDate(ride.created_at)}</p>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                    {ride.status === 'completed' && <span className="text-xs font-bold text-[#84cc16] bg-[#84cc16]/10 px-2 py-0.5 rounded">مكتملة</span>}
                    {ride.status === 'cancelled' && <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">ملغاة</span>}
                    {ride.status === 'rejected' && <span className="text-xs font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded">مرفوضة</span>}

                    {ride.rating && (
                        <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                            <span className="text-xs font-bold text-white">{ride.rating}</span>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );

    return (
        <div className="min-h-screen bg-[#111111] text-white">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center gap-4 bg-[#1A1A1A]">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate("/customer/dashboard")}
                    className="hover:bg-white/5 text-white"
                >
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-xl font-bold">سجل الرحلات</h1>
            </div>

            {/* Tabs */}
            <div className="p-4">
                <Tabs defaultValue="completed" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-[#1A1A1A] border border-white/5 h-12">
                        <TabsTrigger value="completed" className="data-[state=active]:bg-[#84cc16] data-[state=active]:text-black font-bold">ناجحة</TabsTrigger>
                        <TabsTrigger value="cancelled" className="data-[state=active]:bg-red-500 data-[state=active]:text-white font-bold">ملغاة</TabsTrigger>
                        <TabsTrigger value="rejected" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white font-bold">مرفوضة</TabsTrigger>
                    </TabsList>

                    <TabsContent value="completed" className="space-y-3 mt-4">
                        {loading ? <div className="text-center p-10 text-gray-500">جاري التحميل...</div> :
                            getRidesByStatus(["completed"]).length === 0 ? (
                                <div className="p-8 text-center border border-white/5 rounded-2xl bg-[#1A1A1A]">
                                    <p className="text-gray-500">لا توجد رحلات مكتملة</p>
                                </div>
                            ) : (
                                getRidesByStatus(["completed"]).map((ride) => <RideCard key={ride.id} ride={ride} />)
                            )}
                    </TabsContent>

                    <TabsContent value="cancelled" className="space-y-3 mt-4">
                        {loading ? <div className="text-center p-10 text-gray-500">جاري التحميل...</div> :
                            getRidesByStatus(["cancelled"]).length === 0 ? (
                                <div className="p-8 text-center border border-white/5 rounded-2xl bg-[#1A1A1A]">
                                    <p className="text-gray-500">لا توجد رحلات ملغاة</p>
                                </div>
                            ) : (
                                getRidesByStatus(["cancelled"]).map((ride) => <RideCard key={ride.id} ride={ride} />)
                            )}
                    </TabsContent>

                    <TabsContent value="rejected" className="space-y-3 mt-4">
                        {loading ? <div className="text-center p-10 text-gray-500">جاري التحميل...</div> :
                            getRidesByStatus(["rejected"]).length === 0 ? (
                                <div className="p-8 text-center border border-white/5 rounded-2xl bg-[#1A1A1A]">
                                    <p className="text-gray-500">لا توجد رحلات مرفوضة</p>
                                </div>
                            ) : (
                                getRidesByStatus(["rejected"]).map((ride) => <RideCard key={ride.id} ride={ride} />)
                            )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default RideHistory;
