
import React, { useState, useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeButtonProps {
    onComplete: () => void;
    text?: string;
    className?: string;
}

const SwipeButton: React.FC<SwipeButtonProps> = ({
    onComplete,
    text = "Swipe to Go",
    className
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [currentX, setCurrentX] = useState(0);
    const [completed, setCompleted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const sliderRef = useRef<HTMLDivElement>(null);

    const handleStart = (clientX: number) => {
        if (completed) return;
        setIsDragging(true);
        setStartX(clientX);
    };

    const handleMove = (clientX: number) => {
        if (!isDragging || !containerRef.current || !sliderRef.current || completed) return;

        const containerWidth = containerRef.current.clientWidth;
        const sliderWidth = sliderRef.current.clientWidth;
        const maxDrag = containerWidth - sliderWidth - 8; // 8px padding buffer

        let newX = clientX - startX;
        if (newX < 0) newX = 0;
        if (newX > maxDrag) newX = maxDrag;

        setCurrentX(newX);

        // Check completion (if dragged more than 90%)
        if (newX >= maxDrag * 0.9) {
            setCompleted(true);
            setIsDragging(false);
            setCurrentX(maxDrag);
            onComplete();
        }
    };

    const handleEnd = () => {
        if (completed) return;
        setIsDragging(false);
        setCurrentX(0);
    };

    // Mouse Events
    const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX);
    const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
    const onMouseUp = () => handleEnd();
    const onMouseLeave = () => handleEnd();

    // Touch Events
    const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX);
    const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX);
    const onTouchEnd = () => handleEnd();

    return (
        <div
            ref={containerRef}
            className={cn(
                "relative w-full h-16 bg-[#1A1A1A] rounded-full overflow-hidden border border-[#333] flex items-center select-none",
                className
            )}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Background Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                <span className="text-[#666] font-medium text-lg animate-pulse">{text}</span>
            </div>

            {/* Slider */}
            <div
                ref={sliderRef}
                className="absolute left-1 top-1 bottom-1 w-14 h-14 bg-[#F5D848] rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing z-10 transition-transform duration-75 ease-out"
                style={{ transform: `translateX(${currentX}px)` }}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
            >
                <ChevronRight className={cn("w-8 h-8 text-black transition-all", completed ? "opacity-0" : "opacity-100")} />
            </div>

            {/* Success State Overlay */}
            <div
                className={cn(
                    "absolute inset-0 bg-[#F5D848] flex items-center justify-center transition-opacity duration-300 pointer-events-none z-0",
                    completed ? "opacity-100" : "opacity-0"
                )}
            >
                <span className="text-black font-bold text-lg">Let's Go!</span>
            </div>
        </div>
    );
};

export default SwipeButton;
