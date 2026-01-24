import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Car, Phone, Calendar, Star, DollarSign, MapPin,
    FileText, CheckCircle, XCircle, AlertTriangle, Clock
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface DriverDrawerProps {
    driver: any | null;
    open: boolean;
    onClose: () => void;
    onUpdate: () => void; // Refresh list parent
}

export const DriverDetailDrawer = ({ driver, open, onClose, onUpdate }: DriverDrawerProps) => {
    const [stats, setStats] = useState({ earnings: 0, rides: 0, rating: 5.0, monthEarnings: 0, commission: 0 });
    const [recentRides, setRecentRides] = useState<any[]>([]);
    const [loadingStats, setLoadingStats] = useState(false);

    useEffect(() => {
        if (driver?.id && open) {
            fetchDriverStats(driver.id);
        }
    }, [driver, open]);

    const fetchDriverStats = async (driverId: string) => {
        setLoadingStats(true);
        try {
            // 1. Get Completed Rides Count & Earnings
            // Supabase doesn't do "SUM" easily without RPC, but for now let's fetch 'price' of completed rides
            // If the dataset is huge, this is bad, but for <1000 rides it's fine.
            const { data: rides, error } = await supabase
                .from('rides')
                .select('price, status, created_at, pickup_address, destination_address')
                .eq('driver_id', driverId)
                .eq('status', 'completed')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const totalEarnings = rides?.reduce((sum, r) => sum + (r.price || 0), 0) || 0;
            const totalRides = rides?.length || 0;

            // Monthly Calc
            const now = new Date();
            const currentMonthRides = rides?.filter(r => {
                const d = new Date(r.created_at);
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }) || [];

            const monthEarnings = currentMonthRides.reduce((sum, r) => sum + (r.price || 0), 0);
            const commission = monthEarnings * 0.10; // 10%

            setStats({
                earnings: totalEarnings,
                rides: totalRides,
                rating: driver.rating || 5.0,
                monthEarnings,
                commission
            });

            setRecentRides(rides?.slice(0, 5) || []); // Top 5

        } catch (e) {
            console.error("Stats error:", e);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleVerify = async (status: boolean) => {
        if (!driver) return;
        try {
            // Logic match: Verify -> Active + 30 Days. Unverify -> Inactive (Docs kept).
            const updates: any = { is_verified: status };
            if (status) {
                const nextMonth = new Date();
                nextMonth.setDate(nextMonth.getDate() + 30);
                updates.subscription_end_date = nextMonth.toISOString();
            }

            const { error } = await supabase.from('users').update(updates).eq('id', driver.id);
            if (error) throw error;

            toast({ title: status ? "Driver Verified" : "Driver Suspended" });
            onUpdate(); // Refresh parent
            onClose();
        } catch (e) {
            toast({ title: "Error", variant: "destructive" });
        }
    };

    if (!driver) return null;

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent side="right" className="w-full sm:w-[540px] bg-[#0A0A0A] border-l border-[#333] text-white p-0 flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-[#333] bg-[#111]">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4">
                            <Avatar className="w-16 h-16 border-2 border-[#333]">
                                <AvatarImage src={driver.profile_image} className="object-cover" />
                                <AvatarFallback>{driver.full_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    {driver.full_name}
                                    {driver.is_verified ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <Clock className="w-5 h-5 text-yellow-500" />
                                    )}
                                </h2>
                                <p className="text-gray-400 text-sm flex items-center gap-2 mt-1">
                                    <Phone className="w-3 h-3" /> {driver.phone}
                                </p>
                                <div className="flex gap-2 mt-2">
                                    <Badge variant="outline" className="border-[#444] text-gray-300">
                                        {driver.car_model || "No Car"}
                                    </Badge>
                                    <Badge variant="outline" className="border-[#444] text-gray-300">
                                        {driver.license_plate || "No Plate"}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-3 gap-2 p-4 bg-[#0A0A0A]">
                    <Card className="bg-[#161616] border-[#333]">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-xs text-gray-500 mb-1">Total Earnings</span>
                            <span className="text-lg font-bold text-green-400">{stats.earnings.toLocaleString()} DA</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-[#161616] border-[#333]">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-xs text-gray-500 mb-1">Rides</span>
                            <span className="text-lg font-bold text-white">{stats.rides}</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-[#161616] border-[#333]">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <span className="text-xs text-gray-500 mb-1">Subscription</span>
                            {/* Calculate Days */}
                            {(() => {
                                const end = driver.subscription_end_date ? new Date(driver.subscription_end_date) : null;
                                const diff = end ? Math.ceil((end.getTime() - new Date().getTime()) / (86400000)) : 0;
                                return (
                                    <span className={`text-lg font-bold ${diff > 5 ? "text-blue-400" : "text-red-400"}`}>
                                        {diff > 0 ? `${diff} Days` : "Expired"}
                                    </span>
                                );
                            })()}
                        </CardContent>
                    </Card>
                </div>

                {/* Monthly Commission Card */}
                <div className="px-4 pb-4">
                    <Card className="bg-[#1a1010] border-red-500/30">
                        <CardContent className="p-4 flex justify-between items-center">
                            <div>
                                <span className="text-xs text-red-400 block mb-1">Commission Due (This Month - 10%)</span>
                                <span className="text-2xl font-bold text-red-500">{stats.commission.toLocaleString()} DA</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-gray-500 block mb-1">Monthly Earnings</span>
                                <span className="text-sm font-mono text-gray-300">{stats.monthEarnings.toLocaleString()} DA</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <Tabs defaultValue="overview" className="flex-1 flex flex-col">
                        <div className="px-6 border-b border-[#333]">
                            <TabsList className="bg-transparent h-12 w-full justify-start gap-6 p-0">
                                <TabsTrigger value="overview" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0">Overview</TabsTrigger>
                                <TabsTrigger value="docs" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0">Documents</TabsTrigger>
                                <TabsTrigger value="history" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0">Ride History</TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-6">
                                <TabsContent value="overview" className="mt-0 space-y-6">
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-gray-300">Account Actions</h3>
                                        <div className="flex gap-4">
                                            {driver.is_verified ? (
                                                <Button variant="destructive" className="w-full gap-2" onClick={() => handleVerify(false)}>
                                                    <XCircle className="w-4 h-4" /> Suspend / Unverify
                                                </Button>
                                            ) : (
                                                <Button className="w-full gap-2 bg-green-600 hover:bg-green-700" onClick={() => handleVerify(true)}>
                                                    <CheckCircle className="w-4 h-4" /> Approve & Verify
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="docs" className="mt-0 space-y-6">
                                    <div className="grid gap-6">
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-medium text-gray-400">Driving License</h4>
                                            {driver.driving_license_url ? (
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <div className="aspect-video w-full rounded-lg bg-[#222] border border-[#333] overflow-hidden cursor-zoom-in group relative">
                                                            <img src={driver.driving_license_url} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                <span className="text-white text-xs font-medium">Click to Enlarge</span>
                                                            </div>
                                                        </div>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-4xl bg-[#0A0A0A] border-[#333] p-0 overflow-hidden">
                                                        <img src={driver.driving_license_url} className="w-full h-auto" />
                                                    </DialogContent>
                                                </Dialog>
                                            ) : (
                                                <div className="h-32 rounded-lg border border-dashed border-[#333] flex items-center justify-center text-gray-500 text-sm">
                                                    No Document Uploaded
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <h4 className="text-sm font-medium text-gray-400">Vehicle Registration (Grise)</h4>
                                            {driver.carte_grise_url ? (
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <div className="aspect-video w-full rounded-lg bg-[#222] border border-[#333] overflow-hidden cursor-zoom-in group relative">
                                                            <img src={driver.carte_grise_url} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                                <span className="text-white text-xs font-medium">Click to Enlarge</span>
                                                            </div>
                                                        </div>
                                                    </DialogTrigger>
                                                    <DialogContent className="max-w-4xl bg-[#0A0A0A] border-[#333] p-0 overflow-hidden">
                                                        <img src={driver.carte_grise_url} className="w-full h-auto" />
                                                    </DialogContent>
                                                </Dialog>
                                            ) : (
                                                <div className="h-32 rounded-lg border border-dashed border-[#333] flex items-center justify-center text-gray-500 text-sm">
                                                    No Document Uploaded
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-4 pt-4 border-t border-[#333]">
                                        <Button variant="outline" className="flex-1 border-[#444]" onClick={() => console.log("Rejected")}>Reject Docs</Button>
                                        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleVerify(true)}>Approve All</Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="history" className="mt-0">
                                    <div className="space-y-4">
                                        {recentRides.length === 0 ? (
                                            <p className="text-gray-500 text-center py-10">No rides yet.</p>
                                        ) : (
                                            recentRides.map((ride, i) => (
                                                <div key={i} className="flex flex-col gap-2 p-3 rounded-lg bg-[#222] border border-[#333]">
                                                    <div className="flex justify-between">
                                                        <span className="font-bold text-green-400">{ride.price} DA</span>
                                                        <span className="text-xs text-gray-500">{new Date(ride.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="text-xs text-gray-300">
                                                        <p className="truncate">🏁 {ride.destination_address || "No address"}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>
                </div>

            </SheetContent>
        </Sheet>
    );
}
