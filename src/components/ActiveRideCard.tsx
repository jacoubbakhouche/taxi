import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, CheckCircle, Navigation, User, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, PanInfo, AnimatePresence, useDragControls } from "framer-motion";

interface ActiveRideCardProps {
    currentRide: any;
    customerInfo: any;
    driverLocation: [number, number] | null;
    onCompleteRide: () => void;
    onCallCustomer: () => void;
    // Previously passed props are removed to enforce internal state
}

const ActiveRideCard = ({
    currentRide,
    customerInfo,
    driverLocation,
    onCompleteRide,
    onCallCustomer,
}: ActiveRideCardProps) => {
    // STATE: Default to COLLAPSED (false) to minimize obstruction initially?
    // User requested "It comes down and I pull it up".
    const [expanded, setExpanded] = useState(false);

    // Logic to calculate progress, distance, etc.
    let targetLat = 0, targetLng = 0;
    let totalDist = 0;
    let mode = "";

    if (currentRide.status === 'accepted') {
        targetLat = currentRide.pickup_lat;
        targetLng = currentRide.pickup_lng;
        mode = "pickup";
        totalDist = 5;
    } else if (currentRide.status === 'in_progress') {
        targetLat = currentRide.destination_lat;
        targetLng = currentRide.destination_lng;
        mode = "dropoff";
        totalDist = currentRide.distance || 10;
    }

    let distKm = 0;
    let timeMin = 0;
    let progressPercent = 0;

    if (driverLocation) {
        const R = 6371;
        const dLat = (targetLat - driverLocation[0]) * Math.PI / 180;
        const dLon = (targetLng - driverLocation[1]) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(driverLocation[0] * Math.PI / 180) * Math.cos(targetLat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distKm = R * c;

        const speedKmh = 30;
        const timeHours = distKm / speedKmh;
        timeMin = Math.ceil(timeHours * 60);

        if (mode === 'dropoff' && totalDist > 0) {
            progressPercent = Math.max(0, Math.min(100, ((totalDist - distKm) / totalDist) * 100));
        } else {
            progressPercent = Math.max(10, Math.min(95, (1 - (distKm / 5)) * 100));
        }
    }

    // --- DRAG LOGIC ---
    const handleDragEndExpanded = (_: any, info: PanInfo) => {
        // Drag Down (> 50px) to Collapse
        if (info.offset.y > 50) {
            setExpanded(false);
        }
    };

    const handleDragEndCollapsed = (_: any, info: PanInfo) => {
        // Drag Up (< -50px) to Expand
        if (info.offset.y < -50) {
            setExpanded(true);
        }
    };

    return (
        <>
            {/* === COLLAPSED STATE (Floating Pill) === */
                /* Visible when !expanded */
            }
            <AnimatePresence>
                {!expanded && (
                    <motion.div
                        initial={{ y: 200, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 200, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.1}
                        onDragEnd={handleDragEndCollapsed}
                        className="fixed bottom-0 left-0 right-0 z-[3000] px-4 pb-6"
                        onClick={() => setExpanded(true)}
                    >
                        <div className="bg-[#1A1A1A] border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.8)] rounded-3xl p-4 cursor-pointer relative overflow-hidden">
                            {/* Handle */}
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-600/50 rounded-full" />

                            <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                        currentRide.status === 'in_progress' ? "bg-blue-500/20 text-blue-500" : "bg-lime-500/20 text-lime-500"
                                    )}>
                                        <Navigation className="w-5 h-5 fill-current" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold text-white leading-tight">
                                            {currentRide.status === 'in_progress' ? "Heading to Destination" : "Pickup Customer"}
                                        </h2>
                                        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                                            <span className="text-white font-bold">{timeMin} min</span>
                                            <span>•</span>
                                            <span>{distKm.toFixed(1)} km</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Chevron to indicate "Pull Up" */}
                                <div className="text-gray-500">
                                    <ChevronUp className="w-6 h-6 animate-pulse" />
                                </div>
                            </div>

                            {/* Progress Line */}
                            <div className="mt-4 h-1 bg-gray-800 rounded-full overflow-hidden w-full">
                                <div className="h-full bg-current text-[#84cc16]" style={{ width: `${progressPercent}%`, backgroundColor: 'currentColor' }} />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>


            {/* === EXPANDED STATE (Full Drawer) === */
                /* Visible when expanded */
            }
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.1} // Allow some stretch
                        onDragEnd={handleDragEndExpanded}
                        className="fixed bottom-0 left-0 right-0 z-[3001] bg-[#1A1A1A] h-[85vh] rounded-t-[2rem] shadow-2xl border-t border-white/10 flex flex-col"
                    >
                        {/* Header with Handle & Close */}
                        <div
                            className="pt-4 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:bg-white/5"
                            onClick={() => setExpanded(false)}
                        >
                            <div className="w-12 h-1.5 bg-gray-600 rounded-full mb-3" />
                        </div>

                        <div className="px-6 flex-1 overflow-y-auto pb-8">

                            {/* Big Callout */}
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">
                                        {currentRide.status === 'in_progress' ? "Trip in Progress" : "On way to Pickup"}
                                    </h2>
                                    <p className="text-gray-400 text-sm">Follow route on map</p>
                                </div>
                                <div
                                    className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/20"
                                    onClick={() => setExpanded(false)}
                                >
                                    <ChevronDown className="text-white w-6 h-6" />
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-green-500/10 rounded-2xl p-4 text-center border border-green-500/20">
                                    <p className="text-green-500 text-xs uppercase font-bold mb-1">DISTANCE</p>
                                    <p className="text-3xl font-bold text-white">{distKm.toFixed(1)} <span className="text-sm text-gray-400">km</span></p>
                                </div>
                                <div className="bg-blue-500/10 rounded-2xl p-4 text-center border border-blue-500/20">
                                    <p className="text-blue-500 text-xs uppercase font-bold mb-1">ESTIMATED TIME</p>
                                    <p className="text-3xl font-bold text-white">{timeMin} <span className="text-sm text-gray-400">min</span></p>
                                </div>
                            </div>

                            {/* Customer Card */}
                            <div className="bg-white/5 rounded-2xl p-5 border border-white/5 mb-6 flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center shrink-0 border-2 border-white/10 shadow-lg">
                                    {customerInfo?.profile_image ? (
                                        <img src={customerInfo.profile_image} className="w-full h-full object-cover" />
                                    ) : <User className="text-gray-400 w-8 h-8" />}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold text-white">{customerInfo?.full_name || "Customer"}</h3>
                                    <p className="text-sm text-lime-500 flex items-center gap-1">
                                        ★ {customerInfo?.rating?.toFixed(1) || 5.0}
                                        <span className="text-gray-500">({customerInfo?.total_rides || 0} rides)</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-white">{Math.round(currentRide.price || 0)} DA</p>
                                    <span className="bg-white/10 text-white text-[10px] px-2 py-1 rounded uppercase font-bold">Cash</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-4">
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="w-full h-14 rounded-xl border-gray-600 text-gray-300 hover:text-white hover:bg-white/10 font-medium text-lg"
                                    onClick={onCallCustomer}
                                >
                                    <Phone className="mr-3 w-5 h-5" /> Call Customer
                                </Button>

                                <Button
                                    size="lg"
                                    className="w-full h-16 rounded-xl bg-[#84cc16] hover:bg-[#72b01d] text-black text-xl font-bold shadow-xl shadow-lime-500/20"
                                    onClick={onCompleteRide}
                                >
                                    <CheckCircle className="mr-3 w-6 h-6" /> COMPLETE RIDE
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default ActiveRideCard;
