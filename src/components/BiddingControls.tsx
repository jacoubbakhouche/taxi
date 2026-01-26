import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface BiddingControlsProps {
    estimatedPrice: number;
    onPriceChange: (newPrice: number) => void;
}

export const BiddingControls = ({ estimatedPrice, onPriceChange }: BiddingControlsProps) => {
    const [price, setPrice] = useState(estimatedPrice);

    useEffect(() => {
        // Round to nearest 10 or 50? user said 10 or 50.
        // Let's round init price to nearest 10 for clean look
        setPrice(Math.round(estimatedPrice / 10) * 10);
    }, [estimatedPrice]);

    const handleDecrease = () => {
        let newPrice = price - 20; // Decrement step
        const minLimit = Math.round(estimatedPrice * 0.7); // 70% floor
        if (newPrice < minLimit) newPrice = minLimit;
        setPrice(newPrice);
        onPriceChange(newPrice);
    };

    const handleIncrease = () => {
        let newPrice = price + 20; // Increment step
        setPrice(newPrice);
        onPriceChange(newPrice);
    };

    const percentage = ((price - estimatedPrice) / estimatedPrice) * 100;

    return (
        <div className="w-full space-y-3">
            {/* Price Display */}
            <div className="flex items-center justify-between bg-[#2A2A2A] rounded-2xl p-2 border border-white/5">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-xl bg-white/5 hover:bg-white/10 text-white"
                    onClick={handleDecrease}
                    disabled={price <= Math.round(estimatedPrice * 0.7)}
                >
                    <Minus className="w-6 h-6" />
                </Button>

                <div className="text-center">
                    <p className="text-3xl font-bold text-white transition-all key={price}">
                        {price} <span className="text-sm font-normal text-gray-400">دج</span>
                    </p>
                    {/* Status Text Logic */}
                    <div className="h-4 flex items-center justify-center">
                        {percentage <= -15 && (
                            <span className="text-[10px] text-orange-400 flex items-center gap-1 animate-pulse">
                                <Info className="w-3 h-3" /> السعر منخفض، قد تتأخر
                            </span>
                        )}
                        {percentage >= 0 && percentage < 15 && (
                            <span className="text-[10px] text-gray-500">سعر عادل</span>
                        )}
                        {percentage >= 15 && (
                            <span className="text-[10px] text-[#84cc16]">فرصة قبول عالية 🚀</span>
                        )}
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-xl bg-white/5 hover:bg-white/10 text-white"
                    onClick={handleIncrease}
                >
                    <Plus className="w-6 h-6" />
                </Button>
            </div>
        </div>
    );
};
