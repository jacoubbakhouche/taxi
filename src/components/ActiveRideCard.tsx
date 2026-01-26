import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Phone, CheckCircle, Navigation, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, PanInfo, AnimatePresence } from "framer-motion";

interface ActiveRideCardProps {
    currentRide: any;
    customerInfo: any;
    driverLocation: [number, number] | null;
    onCompleteRide: () => void;
    onCallCustomer: () => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
}

const ActiveRideCard = ({
    currentRide,
    customerInfo,
    driverLocation,
    onCompleteRide,
    onCallCustomer,
    isExpanded,
    onToggleExpand,
}: ActiveRideCardProps) => {

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

    // Restore Drag Logic as requested by USER
    const handleDragEnd = (_: any, info: PanInfo) => {
        // If dragged DOWN (positive Y) > threshold, Collapse
        if (info.offset.y > 50 && isExpanded) {
            onToggleExpand();
        }
        // If dragged UP (negative Y) > threshold, Expand
        else if (info.offset.y < -50 && !isExpanded) {
            onToggleExpand();
        }
    };

    return (
        <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }} // Snap back after drag
            dragElastic={0.05} // Stiffer resistance
            onDragEnd={handleDragEnd}
            initial={false}
            animate={isExpanded ? "expanded" : "collapsed"}
            variants={{
                collapsed: { height: 180 }, // Small condensed state
                expanded: { height: "75vh" } // Tall detailed state
            }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[3000] bg-[#1A1A1A] text-white rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5 flex flex-col overflow-hidden"
            style={{ touchAction: "none" }} // Important for mobile drag
        >
            {/* Handle Bar Area - Interactable for Drag */}
            <div
                className="w-full flex items-center justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors"
                onClick={onToggleExpand}
            >
                <div className="h-1.5 w-12 bg-gray-600 rounded-full"></div>
            </div>

            <div className="px-6 flex flex-col h-full">

                {/* === HEADER SECTION (Always Visible) === */}
                <div className="shrink-0 mb-4" onClick={!isExpanded ? onToggleExpand : undefined}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                    currentRide.status === 'in_progress' ? "bg-blue-500 text-white" : "bg-lime-500 text-black"
                                )}>
                                    {currentRide.status === 'in_progress' ? "IN TRIP" : "ACCEPTED"}
                                </span>
                            </div>
                            <h2 className="text-xl font-bold text-white leading-tight">
                                {currentRide.status === 'in_progress' ? "Heading to Destination" : "Picking up Customer"}
                            </h2>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-white">{distKm.toFixed(1)} <span className="text-xs text-gray-500">km</span></div>
                            <div className="text-xs text-gray-400 font-medium">{timeMin} min remaining</div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-2 bg-gray-800 rounded-full">
                        <div
                            className="absolute top-0 left-0 bottom-0 bg-[#84cc16] rounded-full shadow-[0_0_10px_#84cc16] transition-all duration-1000"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                        <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-[#84cc16] transition-all duration-1000"
                            style={{ left: `${progressPercent}%` }}
                        >
                            <Navigation className="w-3 h-3 text-[#84cc16] fill-current transform rotate-45" />
                        </div>
                    </div>
                </div>

                {/* === EXPANDED CONTENT === */}
                {/* We animate opacity to hide content smoothly when collapsed */}
                <motion.div
                    className="flex-1 overflow-y-auto space-y-6 pt-4 pb-20"
                    variants={{
                        collapsed: { opacity: 0, pointerEvents: "none" },
                        expanded: { opacity: 1, pointerEvents: "auto" }
                    }}
                    transition={{ duration: 0.2 }}
                >

                    {/* Customer Info */}
                    <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                        <div className="w-14 h-14 rounded-full bg-gray-700 overflow-hidden border-2 border-white/10 shrink-0 flex items-center justify-center">
                            {customerInfo?.profile_image ? (
                                <img src={customerInfo.profile_image} className="w-full h-full object-cover" />
                            ) : (
                                <User className="w-6 h-6 text-gray-400" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white text-lg truncate">{customerInfo?.full_name || "Customer"}</h3>
                            <div className="flex items-center gap-1 text-sm text-lime-500">
                                <span>★</span> {customerInfo?.rating?.toFixed(1) || "5.0"} <span className="text-gray-500">({customerInfo?.total_rides || 0} rides)</span>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-2xl font-bold text-white">{currentRide.final_price || currentRide.price} <span className="text-sm">DA</span></p>
                            <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">CASH</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <Button
                            size="lg"
                            variant="outline"
                            className="w-full h-14 rounded-xl border-[#84cc16] text-[#84cc16] hover:bg-[#84cc16] hover:text-black font-bold text-lg"
                            onClick={onCallCustomer}
                        >
                            <Phone className="mr-3 w-5 h-5" /> Call Customer
                        </Button>

                        <Button
                            size="lg"
                            className="w-full h-16 rounded-xl bg-[#84cc16] hover:bg-[#E5C838] text-black text-xl font-bold shadow-[0_0_20px_rgba(132,204,22,0.3)] transition-all active:scale-95"
                            onClick={onCompleteRide}
                        >
                            <CheckCircle className="mr-3 w-6 h-6" /> COMPLETE RIDE
                        </Button>
                    </div>
                </motion.div>

            </div>
        </motion.div>
    );
};

export default ActiveRideCard;
