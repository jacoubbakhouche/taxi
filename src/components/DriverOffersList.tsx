import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { User, Star, Check, X, Car, Plus, Minus, Send, Zap, Clock, MapPin, Navigation } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface DriverOffer {
    id: string;
    driver_id: string;
    amount: number;
    created_at?: string;
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
    pickupAddress?: string;
    destinationAddress?: string;
    onAcceptOffer: (offerId: string) => void;
    onCancelRide: () => void;
    onUpdatePrice?: (newPrice: number) => void;
}

// --- Offer Card Component ---
const OfferCard = ({ offer, onAccept, onReject }: { offer: DriverOffer, onAccept: () => void, onReject: () => void }) => {
    const [progress, setProgress] = useState(100);
    const TIMER_MS = 15000; // 15 seconds expiry

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev <= 0) {
                    clearInterval(interval);
                    onReject();
                    return 0;
                }
                return prev - (100 / (TIMER_MS / 100));
            });
        }, 100);
        return () => clearInterval(interval);
    }, []);

    return (
        <Card className="bg-[#1A1A1A] border-white/10 overflow-hidden mb-3 animate-in slide-in-from-bottom-2">
            <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-white">{Math.round(offer.amount)} <span className="text-sm font-normal text-gray-400">دج</span></span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-400 text-sm mt-1">
                            <Clock className="w-3 h-3" />
                            <span>6 دقيقة</span>
                        </div>
                    </div>
                    {offer.driver.rating > 4.8 ? (
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">سائق بلاتيني 💎</Badge>
                    ) : (
                        <Badge className="bg-[#84cc16]/10 text-[#84cc16] border-[#84cc16]/20">أجرة رحلتك 👍</Badge>
                    )}
                </div>

                <div className="flex items-center gap-3 mb-4 bg-white/5 p-3 rounded-xl border border-white/5">
                    <div className="relative">
                        <Avatar className="w-12 h-12 border-2 border-[#84cc16]/20">
                            <AvatarImage src={offer.driver.profile_image || undefined} />
                            <AvatarFallback>{offer.driver.full_name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center shadow-lg border border-[#1A1A1A]">
                            <span>★ {offer.driver.rating.toFixed(1)}</span>
                        </div>
                    </div>

                    <div className="flex-1">
                        <h4 className="font-bold text-white text-base leading-tight">{offer.driver.full_name}</h4>
                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                            <span>{offer.driver.car_model || "سيارة"}</span>
                            <span>•</span>
                            <span>{offer.driver.total_rides} رحلة</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 h-14">
                    <div
                        className="relative flex-1 rounded-xl overflow-hidden cursor-pointer group active:scale-95 transition-transform"
                        onClick={onAccept}
                    >
                        <div className="absolute inset-0 bg-[#3f6212]"></div>
                        <div className="absolute inset-0 bg-[#84cc16] transition-all duration-100 ease-linear" style={{ width: `${progress}%` }}></div>
                        <div className="absolute inset-0 flex items-center justify-center z-10 font-bold text-black text-xl">قبول</div>
                    </div>

                    <Button
                        variant="outline"
                        className="h-full w-24 border-white/10 bg-white/5 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 text-gray-400 font-bold text-lg rounded-xl"
                        onClick={onReject}
                    >
                        رفض
                    </Button>
                </div>
            </div>
        </Card>
    );
};


export const DriverOffersList = ({
    rideId,
    onAcceptOffer,
    onCancelRide,
    currentPrice = 0,
    onUpdatePrice,
    pickupAddress = "موقعي الحالي",
    destinationAddress = "الوجهة المحدد"
}: DriverOffersListProps) => {
    const [offers, setOffers] = useState<DriverOffer[]>([]);
    const [localPrice, setLocalPrice] = useState(currentPrice);
    const [autoAccept, setAutoAccept] = useState(false);
    const [rejectedOfferIds, setRejectedOfferIds] = useState<Set<string>>(new Set());
    const [searchTimeLeft, setSearchTimeLeft] = useState(120); // 2 minutes

    // Initialization
    useEffect(() => {
        if (currentPrice > 0) setLocalPrice(currentPrice);
    }, [currentPrice]);

    // Timer Logic
    useEffect(() => {
        if (offers.length > 0) return; // Stop timer if we have offers? Or keep going? The user said "Process" time.
        // Usually, the 2 mins is "Time to find a driver". If offers exist, we don't auto-cancel.

        const timer = setInterval(() => {
            setSearchTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    onCancelRide(); // Auto cancel
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const handleIncreasePrice = () => setLocalPrice(prev => prev + 15);
    const handleDecreasePrice = () => setLocalPrice(prev => Math.max(0, prev - 15));

    const submitPriceUpdate = () => {
        if (onUpdatePrice) {
            onUpdatePrice(localPrice);
            toast({ title: "تم تحديث السعر", description: `أصبح السعر الآن ${localPrice} دج` });
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // --- Subscription Logic (Same as before) ---
    useEffect(() => {
        fetchOffers();
        const channel = supabase
            .channel(`offers-${rideId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_offers', filter: `ride_id=eq.${rideId}` },
                async (payload) => { await fetchSingleOffer(payload.new.id, payload.new.amount); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [rideId, autoAccept, localPrice, rejectedOfferIds]);

    const fetchOffers = async () => {
        const { data: offersData } = await supabase.from('ride_offers').select('*').eq('ride_id', rideId).eq('status', 'pending').order('amount', { ascending: true });
        if (offersData) {
            const enrichedOffers = await Promise.all(offersData.map(async (offer) => {
                const { data: driver } = await supabase.from('users').select('full_name, profile_image, rating, total_rides, car_model').eq('id', offer.driver_id).single();
                return { ...offer, driver: driver || { full_name: "Unknown", rating: 0 } };
            }));
            setOffers(enrichedOffers.filter(o => !rejectedOfferIds.has(o.id)) as any);
        }
    };

    const fetchSingleOffer = async (offerId: string, amount: number) => {
        if (autoAccept && amount <= localPrice) {
            toast({ title: "قبول تلقائي! ⚡", description: `تم قبول عرض ${amount} دج تلقائياً.` });
            onAcceptOffer(offerId);
            return;
        }
        if (rejectedOfferIds.has(offerId)) return;
        const { data: offer } = await supabase.from('ride_offers').select('*').eq('id', offerId).single();
        if (offer) {
            const { data: driver } = await supabase.from('users').select('full_name, profile_image, rating, total_rides, car_model').eq('id', offer.driver_id).single();
            const enriched = { ...offer, driver: driver || {} };
            setOffers(prev => {
                if (prev.find(o => o.id === offerId)) return prev;
                return [...prev, enriched].sort((a, b) => a.amount - b.amount);
            });
            toast({ title: "عرض جديد!", description: `${driver?.full_name} عرض ${offer.amount} دج` });
        }
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[2000] bg-[#111] rounded-t-[2rem] border-t border-white/10 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-10 flex flex-col max-h-[90vh]">

            <div className="w-full flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-12 h-1 bg-white/20 rounded-full"></div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 pt-2 pb-6">

                {/* Header: Title & Timer */}
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-white font-bold text-lg">{offers.length > 0 ? `يعرض شريكان (${offers.length})` : "في انتظار عروض من السائقين..."}</h2>
                        {offers.length === 0 && <p className="text-xs text-gray-400">نبحث عن أفضل العروض لك</p>}
                    </div>
                    <div className="bg-white/5 px-3 py-1 rounded-full border border-white/5">
                        <span className="font-mono text-[#84cc16] font-bold">{formatTime(searchTimeLeft)}</span>
                    </div>
                </div>

                {/* Price Control Section */}
                <div className="flex gap-2 mb-4">
                    <Button variant="secondary" className="h-14 w-20 rounded-xl bg-[#2A2A2A] text-white hover:bg-[#333] border border-white/5 font-bold text-lg" onClick={handleIncreasePrice}>
                        + 15
                    </Button>
                    <div className="flex-1 bg-[#2A2A2A] rounded-xl flex flex-col items-center justify-center border border-white/5">
                        <span className="text-2xl font-bold text-white">{localPrice} <span className="text-sm font-normal text-gray-400">دج</span></span>
                    </div>
                    <Button variant="secondary" className="h-14 w-20 rounded-xl bg-[#2A2A2A] text-white hover:bg-[#333] border border-white/5 font-bold text-lg" onClick={handleDecreasePrice}>
                        - 15
                    </Button>
                </div>

                <Button className="w-full h-12 bg-[#D1FA58] hover:bg-[#b0d64a] text-black font-bold text-lg rounded-xl mb-4 shadow-lg shadow-[#D1FA58]/10" onClick={submitPriceUpdate}>
                    رفع الأجرة
                </Button>

                {/* Auto Accept Switch */}
                <div className="bg-[#2A2A2A] p-4 rounded-2xl border border-white/5 flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Zap className={`w-6 h-6 ${autoAccept ? 'text-[#84cc16] fill-current' : 'text-gray-500'}`} />
                        <div className="text-right">
                            <p className="text-white text-sm font-bold">قبول تلقائي بسعر {localPrice} دج</p>
                            <p className="text-xs text-gray-500">وقت انتظار 5 من الدقائق</p>
                        </div>
                    </div>
                    <Switch checked={autoAccept} onCheckedChange={setAutoAccept} className="data-[state=checked]:bg-[#84cc16]" />
                </div>

                {/* Cash Info */}
                <div className="bg-[#2A2A2A] p-4 rounded-2xl border border-white/5 flex justify-between items-center mb-4">
                    <span className="text-white font-bold">{localPrice} دج نقداً</span>
                    <div className="text-[#84cc16]">💵</div>
                </div>

                {/* Route Info Cards */}
                <div className="bg-[#2A2A2A] rounded-2xl border border-white/5 mb-6 overflow-hidden">
                    <div className="p-4 border-b border-white/5 flex items-start gap-3">
                        <div className="mt-1 w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                        <div>
                            <p className="text-gray-400 text-xs mb-0.5">موقع الانطلاق</p>
                            <p className="text-white text-sm font-medium line-clamp-1">{pickupAddress}</p>
                        </div>
                    </div>
                    <div className="p-4 flex items-start gap-3">
                        <div className="mt-1 w-3 h-3 rounded-full bg-[#84cc16] shadow-[0_0_10px_rgba(132,204,22,0.5)]"></div>
                        <div>
                            <p className="text-gray-400 text-xs mb-0.5">الوجهة</p>
                            <p className="text-white text-sm font-medium line-clamp-1">{destinationAddress}</p>
                        </div>
                    </div>
                </div>

                {/* Offers List */}
                <div className="space-y-4 mb-6">
                    {offers.map((offer) => (
                        <OfferCard
                            key={offer.id}
                            offer={offer}
                            onAccept={() => onAcceptOffer(offer.id)}
                            onReject={() => {
                                setRejectedOfferIds(prev => new Set(prev).add(offer.id));
                                setOffers(prev => prev.filter(o => o.id !== offer.id));
                            }}
                        />
                    ))}
                </div>

                {/* Dangerous Cancel Button */}
                <Button
                    variant="destructive"
                    className="w-full h-14 bg-[#333] hover:bg-neutral-800 text-white border border-white/10 rounded-xl font-bold text-lg mb-2"
                    onClick={onCancelRide}
                >
                    إلغاء الطلب
                </Button>

            </div>
        </div>
    );
};
