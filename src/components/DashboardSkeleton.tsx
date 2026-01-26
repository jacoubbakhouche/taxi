import { Skeleton } from "@/components/ui/skeleton";

export const DashboardSkeleton = () => {
    return (
        <div className="h-screen flex flex-col bg-[#1A1A1A] relative overflow-hidden">
            {/* Header Skeleton */}
            <div className="absolute top-0 left-0 right-0 z-[3000] p-4 flex justify-between items-start">
                <Skeleton className="h-10 w-32 rounded-full bg-white/10" />
                <Skeleton className="h-12 w-12 rounded-full bg-white/10" />
            </div>

            {/* Map Skeleton (Dark background with pulsing center) */}
            <div className="absolute inset-0 z-0 bg-[#242424] flex items-center justify-center">
                <div className="relative flex items-center justify-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full animate-ping"></div>
                    <Skeleton className="w-12 h-12 rounded-full bg-white/10 absolute" />
                </div>
            </div>

            {/* Bottom Sheet Skeleton */}
            <div className="fixed bottom-0 left-0 right-0 z-[1000] p-6 pb-8 bg-[#1A1A1A] rounded-t-[2rem] border-t border-white/5">
                <div className="w-full flex justify-center pb-5">
                    <Skeleton className="w-12 h-1.5 rounded-full bg-white/10" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-12 flex-1 rounded-xl bg-white/10" />
                    <Skeleton className="h-12 w-12 rounded-xl bg-white/10" />
                </div>
            </div>
        </div>
    );
};
