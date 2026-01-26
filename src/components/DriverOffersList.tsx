import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { User, Star, Check, X, Car, Plus, Minus, Send, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
    currentPrice?: number;
    onAcceptOffer: (offerId: string) => void;
    onCancelRide: () => void;
    onUpdatePrice?: (newPrice: number) => void;
}

export const DriverOffersList = ({
    rideId,
    onAcceptOffer,
    onCancelRide,
    currentPrice = 0,
    onUpdatePrice
}: DriverOffersListProps) => {
    const [offers, setOffers] = useState<DriverOffer[]>([]);
    const [localPrice, setLocalPrice] = useState(currentPrice);
    const [autoAccept, setAutoAccept] = useState(false);

    // Sync local price if prop changes externally (initial load)
    useEffect(() => {
        if (currentPrice > 0) setLocalPrice(currentPrice);
    }, [currentPrice]);

    const handleIncreasePrice = () => {
        const newPrice = localPrice + 15;
        setLocalPrice(newPrice);
    };

    const handleDecreasePrice = () => {
        const newPrice = Math.max(0, localPrice - 15);
        setLocalPrice(newPrice);
    };

    const submitPriceUpdate = () => {
        if (onUpdatePrice) {
            onUpdatePrice(localPrice);
            toast({ title: "تم تحديث السعر", description: `أصبح السعر الآن ${localPrice} دج` });
        }
    };

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
                    await fetchSingleOffer(payload.new.id, payload.new.amount);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [rideId, autoAccept, localPrice]);

    const fetchOffers = async () => {
        const { data: offersData, error } = await supabase
            .from('ride_offers')
            .select('*')
            .eq('ride_id', rideId)
            .eq('status', 'pending')
            .order('amount', { ascending: true });

        if (error) {
            console.error("Error fetching offers:", error);
            return;
        }

        if (offersData) {
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

    const fetchSingleOffer = async (offerId: string, amount: number) => {
        // AUTO ACCEPT LOGIC
        if (autoAccept && amount <= localPrice) {
            toast({ title: "قبول تلقائي! ⚡", description: `تم قبول عرض ${amount} دج تلقائياً.` });
            onAcceptOffer(offerId);
            return;
        }

        const { data: offer } = await supabase.from('ride_offers').select('*').eq('id', offerId).single();
        if (offer) {
            const { data: driver } = await supabase
                .from('users')
                .select('full_name, profile_image, rating, total_rides, car_model')
                .eq('id', offer.driver_id)
                .single();

            const enriched = { ...offer, driver: driver || {} };
            setOffers(prev => {
                if (prev.find(o => o.id === offerId)) return prev;
                return [...prev, enriched].sort((a, b) => a.amount - b.amount);
            });

            toast({ title: "عرض جديد!", description: `${driver?.full_name} عرض ${offer.amount} دج` });
        }
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[2000] bg-[#111] rounded-t-[2rem] border-t border-white/10 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-10 pb-6">

            {/* Handle */}
            <div className="w-full flex justify-center pt-3 pb-1">
                <div className="w-12 h-1 bg-white/20 rounded-full"></div>
            </div>

            {/* Header Status */}
            <div className="px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="flex -space-x-3 space-x-reverse">
                        {/* Stacked avatars simulation */}
                        <Avatar className="w-8 h-8 border-2 border-[#111]">
                            <AvatarFallback className="bg-gray-700 text-[10px]">1</AvatarFallback>
                        </Avatar>
                        <Avatar className="w-8 h-8 border-2 border-[#111]">
                            <AvatarFallback className="bg-gray-700 text-[10px]">2</AvatarFallback>
                        </Avatar>
                    </div>
                    <span className="text-gray-300 text-sm">يعرض شريكان ({offers.length}) عرض طلبك</span>
                </div>
            </div>

            <div className="px-5 space-y-4 mt-2">

                {/* Timer / Status Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs text-gray-400 font-medium px-1">
                        <span>01:48</span>
                        <span>الأجرة أقل من المتوسط. توقع عروضًا أقل</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-white w-1/3 rounded-full animate-pulse"></div>
                    </div>
                </div>

                {/* Price Control Section */}
                <div className="bg-[#222] p-1 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between mb-2 p-1">
                        <Button variant="ghost" className="h-12 w-24 bg-[#333] hover:bg-[#444] rounded-xl text-white font-bold text-lg" onClick={handleIncreasePrice}>
                            + 15
                        </Button>

                        <div className="text-center">
                            <span className="text-3xl font-bold text-white block">{localPrice} <span className="text-sm text-gray-400 font-normal">دج</span></span>
                        </div>

                        <Button variant="ghost" className="h-12 w-24 bg-[#333] hover:bg-[#444] rounded-xl text-white/50 font-bold text-lg" onClick={handleDecreasePrice}>
                            - 15
                        </Button>
                    </div>
                    <Button className="w-full h-10 bg-[#333] hover:bg-[#444] text-gray-300 font-medium rounded-xl text-sm" onClick={submitPriceUpdate}>
                        تأكيد رفع الأجرة
                    </Button>
                </div>

                {/* Auto Accept Toggle */}
                <div className="bg-[#222] p-4 rounded-2xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center">
                            <Zap className="text-white w-5 h-5" />
                        </div>
                        <div className="text-right">
                            <p className="text-white text-sm font-bold">قبول تلقائي بسعر {localPrice} دج</p>
                            <p className="text-xs text-gray-500">وقت انتظار 5 من الدقائق</p>
                        </div>
                    </div>
                    <Switch checked={autoAccept} onCheckedChange={setAutoAccept} className="data-[state=checked]:bg-white" />
                </div>

                {/* Payment Method */}
                <div className="bg-[#222] p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                    <span className="text-white font-bold text-sm">{localPrice} دج نقدًا</span>
                    <CoinsIcon className="text-[#84cc16]" />
                </div>

                {/* Offers List (Scrollable if many) */}
                {offers.length > 0 && (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        <h3 className="text-sm font-bold text-gray-400 px-2 mt-2">العروض ({offers.length})</h3>
                        {offers.map((offer) => (
                            <div key={offer.id} className="flex items-center justify-between bg-[#2A2A2A] p-3 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={offer.driver.profile_image || undefined} />
                                        <AvatarFallback>{offer.driver.full_name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-bold text-white text-sm">{offer.driver.full_name}</p>
                                        <p className="text-[#84cc16] text-xs font-bold">{offer.amount} دج</p>
                                    </div>
                                </div>
                                <Button size="sm" className="bg-[#84cc16] text-black hover:bg-[#74b413] font-bold h-8 px-4 rounded-lg" onClick={() => onAcceptOffer(offer.id)}>
                                    قبول
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                <Button variant="ghost" className="w-full text-red-500 hover:bg-red-500/10 hover:text-red-400 mt-2" onClick={onCancelRide}>
                    إلغاء البحث
                </Button>

            </div>
        </div>
    );
};

const CoinsIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <circle cx="8" cy="8" r="6" />
        <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
        <path d="M7 6h1v4" />
        <path d="m16.71 13.88.7 .71-2.82 2.82" />
    </svg>
)
