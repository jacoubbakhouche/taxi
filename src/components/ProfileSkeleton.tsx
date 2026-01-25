
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export const ProfileSkeleton = () => {
    return (
        <div className="min-h-screen bg-background pb-20 animate-in fade-in duration-500">
            {/* Header Skeleton */}
            <div className="bg-gradient-to-b from-[#1A1A1A] to-[#111] p-6 pb-20 border-b border-white/5">
                <div className="flex items-center justify-between mb-6">
                    <Skeleton className="w-10 h-10 rounded-full bg-white/10" />
                    <Skeleton className="w-10 h-10 rounded-full bg-white/10" />
                </div>

                <div className="text-center">
                    <Skeleton className="w-24 h-24 rounded-full mx-auto border-4 border-white/5 bg-white/10" />
                    <Skeleton className="h-8 w-48 mx-auto mt-4 bg-white/10" />
                    <div className="flex justify-center gap-2 mt-2">
                        <Skeleton className="h-4 w-4 bg-white/10" />
                        <Skeleton className="h-4 w-32 bg-white/10" />
                    </div>

                    <div className="flex items-center justify-center gap-6 mt-8">
                        <div>
                            <Skeleton className="h-8 w-12 mx-auto mb-1 bg-white/10" />
                            <Skeleton className="h-3 w-8 mx-auto bg-white/10" />
                        </div>
                        <div className="w-px h-12 bg-white/10"></div>
                        <div>
                            <Skeleton className="h-8 w-12 mx-auto mb-1 bg-white/10" />
                            <Skeleton className="h-3 w-8 mx-auto bg-white/10" />
                        </div>
                    </div>
                </div>
            </div>

            {/* List Skeleton */}
            <div className="px-4 -mt-8 space-y-4">
                <Skeleton className="h-10 w-full rounded-lg bg-gray-200 dark:bg-[#222]" />

                <div className="space-y-4 pt-4">
                    {[1, 2, 3].map((i) => (
                        <Card key={i} className="p-4 space-y-3 bg-card/50">
                            <div className="flex justify-between">
                                <div className="space-y-2 flex-1">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                                <Skeleton className="h-6 w-16" />
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};
