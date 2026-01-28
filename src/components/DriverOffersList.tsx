import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { User, Star, Check, X, Car, Plus, Minus, Send, Zap, Clock, MapPin, Navigation } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { playSound } from "@/utils/audio";

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

    // Timer State
    const TOTAL_SEARCH_TIME = 120; // 2 minutes
    const [searchTimeLeft, setSearchTimeLeft] = useState(TOTAL_SEARCH_TIME);
    const [isTimeout, setIsTimeout] = useState(false);

    // Initialization
    useEffect(() => {
        if (currentPrice > 0) setLocalPrice(currentPrice);
    }, [currentPrice]);

    // Auto-Accept Sync
    useEffect(() => {
        const syncAutoAccept = async () => {
            const priceToSet = autoAccept ? localPrice : null;
            // Fire and forget update
            await supabase.from('rides').update({ auto_accept_price: priceToSet }).eq('id', rideId);
        };
        syncAutoAccept();
    }, [autoAccept, localPrice, rideId]);

    // Timer Logic
    useEffect(() => {
        if (offers.length > 0) return; // Stop timer if we have offers

        const timer = setInterval(() => {
            setSearchTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setIsTimeout(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [offers.length]);

    const handleIncreasePrice = () => setLocalPrice(prev => prev + 15);
    const handleDecreasePrice = () => setLocalPrice(prev => Math.max(0, prev - 15));

    const submitPriceUpdate = () => {
        if (onUpdatePrice) {
            onUpdatePrice(localPrice);
            toast({ title: "تم تحديث السعر", description: `أصبح السعر الآن ${localPrice} دج` });
            // Reset timer on price update? Maybe. Let's keep it simple for now.
        }
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // --- Subscription Logic ---
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
            const valid = enrichedOffers.filter(o => !rejectedOfferIds.has(o.id));
            setOffers(valid as any);
            // If offers exist, clear timeout if set
            if (valid.length > 0) setIsTimeout(false);
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
                playSound('offer'); // Play sound on new offer
                return [...prev, enriched].sort((a, b) => a.amount - b.amount);
            });
            setIsTimeout(false); // Reset timeout
            toast({ title: "عرض جديد!", description: `${driver?.full_name} عرض ${offer.amount} دج` });
        }
    };

    // Calculate Progress Percentage
    const progressPercent = (searchTimeLeft / TOTAL_SEARCH_TIME) * 100;

    if (isTimeout && offers.length === 0) {
        return (
            <div className="fixed bottom-0 left-0 right-0 z-[2000] bg-[#111] rounded-t-[2rem] border-t border-white/10 p-6 animate-in slide-in-from-bottom-10">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-2">
                        <Clock className="w-8 h-8 text-yellow-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">لم يتم العثور على سائقين</h3>
                        <p className="text-gray-400 mt-1">انتهى الوقت المحدد للبحث. هل تريد الاستمرار في البحث أو إلغاء الطلب؟</p>
                    </div>
                    <div className="flex gap-3 w-full mt-4">
                        <Button
                            className="flex-1 bg-[#84cc16] hover:bg-[#65a30d] text-black font-bold h-12 rounded-xl"
                            onClick={() => {
                                setSearchTimeLeft(TOTAL_SEARCH_TIME);
                                setIsTimeout(false);
                            }}
                        >
                            استمرار البحث
                        </Button>
                        <Button
                            variant="destructive"
                            className="flex-1 bg-[#333] hover:bg-neutral-800 text-white font-bold h-12 rounded-xl"
                            onClick={onCancelRide}
                        >
                            إلغاء الطلب
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* --- LAYER 1: Active Bidding Card (Always at Bottom) --- */}
            {/* --- LAYER 1: Active Bidding Card (Base) --- */}
            {/* Stays anchored at the bottom. Handles timer, pricing, and auto-accept. */}
            <div className={`fixed bottom-0 left-0 right-0 z-[2000] bg-[#111] rounded-t-[2rem] border-t border-white/10 shadow-[0_-10px_50px_rgba(0,0,0,0.8)] transition-all duration-500 ease-in-out ${offers.length > 0 ? 'scale-95 opacity-50 blur-[1px]' : 'scale-100 opacity-100'}`}>

                {/* Drag Handle */}
                <div className="w-full flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-12 h-1 bg-white/20 rounded-full"></div>
                </div>

                {/* Progress Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800/50 rounded-t-[2rem] overflow-hidden">
                    <div
                        className="h-full bg-[#84cc16] transition-all duration-1000 ease-linear shadow-[0_0_10px_#84cc16]"
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>

                <div className="px-5 pt-4 pb-6">
                    {/* Header: Title & Timer */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-white font-bold text-lg">جاري البحث عن سائق...</h2>
                            <p className="text-xs text-gray-400">سيظهر العرض الأنسب لك هنا</p>
                        </div>
                        <div className="bg-[#2A2A2A] px-3 py-1 rounded-full border border-white/5 flex items-center gap-2">
                            <Clock className="w-3 h-3 text-[#84cc16]" />
                            <span className="font-mono text-white font-bold text-sm">{formatTime(searchTimeLeft)}</span>
                        </div>
                    </div>

                    {/* Auto Accept Toggle (Restored) */}
                    <div className="flex items-center justify-between bg-[#1A1A1A] p-3 rounded-xl border border-white/5 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-[#84cc16]/10 text-[#84cc16]">
                                <Zap className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="text-white text-sm font-bold">قبول تلقائي</h4>
                                <p className="text-[10px] text-gray-400">قبول العروض التي تطابق سعرك مباشرة</p>
                            </div>
                        </div>
                        <Switch
                            checked={autoAccept}
                            onCheckedChange={setAutoAccept}
                            className="data-[state=checked]:bg-[#84cc16]"
                        />
                    </div>

                    {/* Route Info (Restored) */}
                    <div className="bg-[#1A1A1A] p-3 rounded-xl border border-white/5 mb-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                            <p className="text-white text-sm truncate">{pickupAddress}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Navigation className="w-4 h-4 text-[#84cc16] shrink-0" />
                            <p className="text-white text-sm truncate">{destinationAddress}</p>
                        </div>
                    </div>

                    {/* Price Controls */}
                    <div className="flex gap-2 mb-3">
                        <Button variant="secondary" className="h-12 w-16 rounded-xl bg-[#2A2A2A] text-white hover:bg-[#333] border border-white/5 font-bold text-lg pointer-events-auto" onClick={handleDecreasePrice}>-15</Button>
                        <div className="flex-1 bg-[#2A2A2A] rounded-xl flex flex-col items-center justify-center border border-white/5">
                            <span className="text-2xl font-bold text-white tracking-tight">{localPrice} <span className="text-sm font-normal text-gray-500">دج</span></span>
                        </div>
                        <Button variant="secondary" className="h-12 w-16 rounded-xl bg-[#2A2A2A] text-white hover:bg-[#333] border border-white/5 font-bold text-lg pointer-events-auto" onClick={handleIncreasePrice}>+15</Button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <Button variant="destructive" onClick={onCancelRide} className="flex-1 bg-[#333] text-white hover:bg-red-500/20 hover:text-red-500 border border-white/5 font-bold h-12 rounded-xl pointer-events-auto">
                            إلغاء
                        </Button>
                        <Button className="flex-[2] bg-[#84cc16] hover:bg-[#65a30d] text-black font-bold h-12 rounded-xl pointer-events-auto border-b-4 border-[#5a8a12] active:border-b-0 active:translate-y-1 transition-all" onClick={submitPriceUpdate}>
                            تحديث السعر 🔥
                        </Button>
                    </div>
                </div>
            </div>

            {/* --- LAYER 2: Offers Overlay (Pop-up Sheet) --- */}
            {offers.length > 0 && (
                <div className="fixed inset-0 z-[2500] flex flex-col justify-end">

                    {/* Backdrop (Dimming Layer 1) */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"></div>

                    {/* The Offers Sheet */}
                    <div className="relative z-10 bg-[#1A1A1A] rounded-t-[2.5rem] shadow-2xl border-t border-white/15 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-20 duration-500">

                        {/* Sheet Handle */}
                        <div className="w-full flex justify-center pt-4 pb-2">
                            <div className="w-14 h-1.5 bg-zinc-600 rounded-full"></div>
                        </div>

                        {/* Title Context */}
                        <div className="px-6 pb-4 pt-2 border-b border-white/5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-white font-bold text-xl">
                                    وصلتك {offers.length} عروض! 🎉
                                </h3>
                                <Badge className="bg-[#84cc16] text-black font-bold border-0">
                                    أفضل عرض: {Math.min(...offers.map(o => o.amount))} دج
                                </Badge>
                            </div>
                            <p className="text-zinc-400 text-sm mt-1">اختر السائق المناسب لك من القائمة أدناه.</p>
                        </div>

                        {/* Scrollable Offers List */}
                        <div className="overflow-y-auto p-4 space-y-3 pb-safe-bottom min-h-[40vh]">
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

                        {/* Bottom Action Area in Overlay */}
                        <div className="p-4 bg-[#111] border-t border-white/10 pb-8">
                            <Button
                                variant="outline"
                                className="w-full h-12 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-400 font-bold rounded-xl"
                                onClick={onCancelRide}
                            >
                                إلغاء كل شيء
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
