import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { User, Star, Check, X, Car } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DriverOffer {
    id: string;
    driver_id: string;
    amount: number;
    driver: {
        full_name: string;
        profile_image: string | null;
        rating: number;
        total_rides: number;
        car_model: string;
    };
}

interface DriverOffersListProps {
    rideId: string;
    onAcceptOffer: (offerId: string) => void;
    onCancelRide: () => void;
}

export const DriverOffersList = ({ rideId, onAcceptOffer, onCancelRide }: DriverOffersListProps) => {
    const [offers, setOffers] = useState<DriverOffer[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Initial fetch
        fetchOffers();

        // Subscribe to new offers
        const channel = supabase
            .channel(`offers-${rideId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'ride_offers',
                    filter: `ride_id=eq.${rideId}`,
                },
                async (payload) => {
                    console.log("New offer received:", payload.new);
                    // Fetch the driver details for the new offer
                    await fetchSingleOffer(payload.new.id);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [rideId]);

    const fetchOffers = async () => {
        // Need to join with users table manually or via separate queries if relations aren't perfect in client types
        // Using a manual approach for robustness in this context
        const { data: offersData, error } = await supabase
            .from('ride_offers')
            .select('*')
            .eq('ride_id', rideId)
            .eq('status', 'pending')
            .order('amount', { ascending: true }); // Show cheapest first? Or newest? let's do cheapest.

        if (error) {
            console.error("Error fetching offers:", error);
            return;
        }

        if (offersData) {
            // Enrich with driver info
            // Using Promise.all to fetch driver details (Optimizable later)
            const enrichedOffers = await Promise.all(
                offersData.map(async (offer) => {
                    const { data: driver } = await supabase
                        .from('users')
                        .select('full_name, profile_image, rating, total_rides, car_model')
                        .eq('id', offer.driver_id)
                        .single();

                    return {
                        ...offer,
                        driver: driver || { full_name: "Unknown", rating: 0 }
                    };
                })
            );
            setOffers(enrichedOffers as any);
        }
    };

    const fetchSingleOffer = async (offerId: string) => {
        const { data: offer } = await supabase.from('ride_offers').select('*').eq('id', offerId).single();
        if (offer) {
            const { data: driver } = await supabase
                .from('users')
                .select('full_name, profile_image, rating, total_rides, car_model')
                .eq('id', offer.driver_id)
                .single();

            const enriched = { ...offer, driver: driver || {} };
            setOffers(prev => {
                // Prevent duplicates
                if (prev.find(o => o.id === offerId)) return prev;
                return [...prev, enriched].sort((a, b) => a.amount - b.amount);
            });

            // Play notification sound?
            toast({ title: "عرض جديد!", description: `${driver?.full_name} عرض ${offer.amount} دج` });
        }
    };

    return (
        <div className="absolute inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center p-4 animate-in fade-in">
            <div className="bg-[#1A1A1A] w-full max-w-md mx-auto rounded-3xl border border-white/10 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#222]">
                    <div>
                        <h2 className="text-white font-bold text-lg">العروض الحالية ({offers.length})</h2>
                        <p className="text-xs text-gray-400">اختر السائق المناسب لك</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={onCancelRide} className="h-8 text-xs rounded-full">
                        إلغاء الطلب
                    </Button>
                </div>

                <div className="overflow-y-auto p-4 space-y-3 flex-1">
                    {offers.length === 0 ? (
                        <div className="text-center py-12 space-y-4">
                            <div className="animate-spin w-8 h-8 border-2 border-[#84cc16] border-t-transparent rounded-full mx-auto"></div>
                            <p className="text-gray-400 animate-pulse">جاري انتظار عروض السائقين...</p>
                        </div>
                    ) : (
                        offers.map((offer) => (
                            <Card key={offer.id} className="p-3 bg-[#2A2A2A] border-white/5 text-white flex items-center gap-3 hover:bg-[#333] transition-colors">
                                <Avatar className="w-12 h-12 border border-white/10">
                                    <AvatarImage src={offer.driver.profile_image || undefined} />
                                    <AvatarFallback><User className="w-6 h-6" /></AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-sm truncate">{offer.driver.full_name}</h3>
                                        <div className="flex items-center text-[10px] text-[#84cc16] bg-[#84cc16]/10 px-1.5 py-0.5 rounded">
                                            <Star className="w-3 h-3 mr-0.5 fill-current" />
                                            {offer.driver.rating?.toFixed(1) || "5.0"}
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                                        <Car className="w-3 h-3" />
                                        <span>{offer.driver.car_model || "سيارة"}</span>
                                        <span>•</span>
                                        <span>{offer.driver.total_rides || 0} رحلة</span>
                                    </div>
                                </div>

                                <div className="text-left">
                                    <p className="text-xl font-bold text-[#84cc16]">{Math.round(offer.amount)} <span className="text-xs text-gray-500">دج</span></p>
                                    <Button
                                        size="sm"
                                        className="mt-1 h-8 w-full bg-[#84cc16] hover:bg-[#65a30d] text-black font-bold text-xs"
                                        onClick={() => onAcceptOffer(offer.id)}
                                    >
                                        قبول
                                    </Button>
                                </div>
                            </Card>
                        ))
                    )}
                </div>

                <div className="p-3 bg-yellow-500/10 text-yellow-500 text-xs text-center border-t border-yellow-500/20">
                    ⚠️ السعر المعروض هو السعر النهائي للرحلة
                </div>
            </div>
        </div>
    );
};
