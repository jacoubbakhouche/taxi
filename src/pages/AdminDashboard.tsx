
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LogOut, Search, ShieldCheck, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // ... (keep useEffect and checkAdmin) ...

    const fetchDrivers = async () => {
        try {
            console.log("Fetching drivers...");
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'driver')
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Supabase Error:", error);
                toast({ title: "Error Fetching Data", description: error.message, variant: "destructive" });
                throw error;
            }

            console.log("Drivers loaded:", data?.length);
            setDrivers(data || []);
        } catch (error) {
            console.error("Fetch failed:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleVerification = async (userId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('users')
                .update({ is_verified: !currentStatus })
                .eq('id', userId);

            if (error) throw error;

            setDrivers(drivers.map(d =>
                d.id === userId ? { ...d, is_verified: !currentStatus } : d
            ));

            toast({
                title: !currentStatus ? "Driver Activated ✅" : "Driver Deactivated 🚫",
                description: `Status updated successfully.`,
                variant: !currentStatus ? "default" : "destructive"
            });

        } catch (error) {
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        }
    };

    const deactivateAllDrivers = async () => {
        if (!window.confirm("ARE YOU SURE? This will deactivate ALL drivers and force them to re-upload documents.")) return;

        try {
            const { error } = await supabase
                .from('users')
                .update({
                    is_verified: false,
                    documents_submitted: false,
                    driving_license_url: null,
                    carte_grise_url: null
                })
                .eq('role', 'driver');

            if (error) throw error;

            // Update local state to reflect the "fresh" state
            setDrivers(drivers.map(d => ({
                ...d,
                is_verified: false,
                documents_submitted: false,
                driving_license_url: null,
                carte_grise_url: null
            })));

            toast({
                title: "System Reset ⚠️",
                description: "All drivers reset. They must re-upload documents.",
                variant: "destructive"
            });
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to reset drivers", variant: "destructive" });
        }
    };

    const verifyDriver = async (driverId: string, approve: boolean) => {
        try {
            const updates: any = { is_verified: approve };
            if (!approve) {
                // If rejected, reset submission so they can upload again
                updates.documents_submitted = false;
                updates.driving_license_url = null;
                updates.carte_grise_url = null;
            }

            const { error } = await supabase
                .from('users')
                .update(updates)
                .eq('id', driverId);

            if (error) throw error;

            setDrivers(drivers.map(d =>
                d.id === driverId ? { ...d, ...updates } : d
            ));

            toast({
                title: approve ? "Driver Approved ✅" : "Request Rejected ❌",
                description: approve ? "Driver can now accept rides." : "Driver has been notified to re-upload documents.",
                variant: approve ? "default" : "destructive"
            });
        } catch (error) {
            toast({ title: "Error", description: "Operation failed", variant: "destructive" });
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/admin");
    };

    const handleViewDocument = (url: string | null) => {
        if (!url) return;
        setSelectedImage(url);
    };

    const filteredDrivers = drivers.filter(d =>
        d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.phone?.includes(search) ||
        d.license_plate?.toLowerCase().includes(search.toLowerCase())
    );

    const pendingDrivers = filteredDrivers.filter(d => !d.is_verified && d.documents_submitted);
    const activeDrivers = filteredDrivers.filter(d => d.is_verified || (!d.is_verified && !d.documents_submitted));

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <header className="bg-[#111] border-b border-[#333] px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                        <ShieldCheck className="text-primary w-6 h-6" />
                    </div>
                    <h1 className="font-bold text-xl text-white">Taxi DZ Admin</h1>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="destructive"
                        onClick={deactivateAllDrivers}
                        className="bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/40"
                    >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reset System
                    </Button>
                    <Button variant="outline" onClick={handleLogout} className="gap-2 border-[#444] text-white hover:bg-[#222]">
                        <LogOut className="w-4 h-4" /> Logout
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="p-6 max-w-7xl mx-auto space-y-6">

                <Tabs defaultValue="active" className="w-full">
                    <TabsList className="bg-[#111] border border-[#333] mb-6">
                        <TabsTrigger value="active" className="data-[state=active]:bg-[#222] text-gray-400 data-[state=active]:text-white">Active / All Drivers</TabsTrigger>
                        <TabsTrigger value="requests" className="data-[state=active]:bg-[#222] text-gray-400 data-[state=active]:text-white flex gap-2">
                            Verification Requests
                            {pendingDrivers.length > 0 && (
                                <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full">{pendingDrivers.length}</span>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {/* SEARCH BAR (Common) */}
                    <div className="mb-6 relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            placeholder="Search..."
                            className="pl-10 bg-[#111] border-[#333] text-white placeholder:text-gray-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <TabsContent value="active">
                        <Card className="p-6 bg-[#111] border-[#333] text-white">
                            {/* ... EXISTING TABLE LOGIC BUT USING activeDrivers ... */}
                            <div className="rounded-md border border-[#333]">
                                <Table>
                                    <TableHeader className="bg-[#1A1A1A]">
                                        <TableRow className="border-[#333] hover:bg-[#222]">
                                            <TableHead className="text-gray-400">Driver</TableHead>
                                            <TableHead className="text-gray-400">Vehicle Info</TableHead>
                                            <TableHead className="text-gray-400">License Plate</TableHead>
                                            <TableHead className="text-gray-400">Status</TableHead>
                                            <TableHead className="text-right text-gray-400">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {activeDrivers.length === 0 ? (
                                            <TableRow className="border-[#333] hover:bg-[#222]">
                                                <TableCell colSpan={5} className="text-center h-32 text-gray-500">No active drivers found.</TableCell>
                                            </TableRow>
                                        ) : (
                                            activeDrivers.map((driver) => (
                                                <TableRow key={driver.id} className="border-[#333] hover:bg-[#1A1A1A]">
                                                    {/* ... EXISTING ROW CONTENT ... */}
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden border border-gray-700">
                                                                {driver.profile_image ? (
                                                                    <img src={driver.profile_image} alt={driver.full_name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">IMG</div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-white">{driver.full_name || "Unknown"}</p>
                                                                <p className="text-xs text-gray-400">{driver.phone}</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <p className="text-gray-200">{driver.car_model || "Not set"}</p>
                                                        <span className="text-xs text-gray-500 capitalize">{driver.work_type}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="font-mono bg-[#222] text-gray-300 border-[#444]">
                                                            {driver.license_plate || "MISSING"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {driver.is_verified ? (
                                                            <Badge className="bg-green-900/30 text-green-400 hover:bg-green-900/40 border-green-800 gap-1">
                                                                <CheckCircle className="w-3 h-3" /> Active
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/40 border-yellow-800 gap-1">
                                                                <Loader2 className="w-3 h-3" /> Pending
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            size="sm"
                                                            variant={driver.is_verified ? "destructive" : "default"}
                                                            className={driver.is_verified ? "bg-red-900/30 text-red-400 hover:bg-red-900/50 shadow-none border border-red-900" : "bg-green-600 hover:bg-green-700"}
                                                            onClick={() => toggleVerification(driver.id, driver.is_verified)}
                                                        >
                                                            {driver.is_verified ? "Deactivate" : "Activate"}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    </TabsContent>

                    <TabsContent value="requests">
                        <div className="grid gap-4">
                            {pendingDrivers.length === 0 ? (
                                <div className="text-center py-20 text-gray-500">
                                    <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>No pending document verifications.</p>
                                </div>
                            ) : (
                                pendingDrivers.map((driver) => (
                                    <Card key={driver.id} className="p-6 bg-[#111] border-[#333] text-white">
                                        <div className="flex flex-col md:flex-row justify-between gap-6">
                                            {/* Driver Info */}
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 rounded-full bg-gray-800 overflow-hidden border border-gray-700">
                                                    {driver.profile_image ? (
                                                        <img src={driver.profile_image} alt="Profile" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-500">IMG</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold">{driver.full_name}</h3>
                                                    <p className="text-gray-400 text-sm">{driver.phone}</p>
                                                    <div className="flex gap-2 mt-2">
                                                        <Badge variant="outline" className="bg-[#222] border-[#444] text-xs">
                                                            {driver.car_model} - {driver.license_plate}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Documents */}
                                            <div className="flex-1 flex gap-4 overflow-x-auto pb-2">
                                                {/* License */}
                                                <div className="space-y-2">
                                                    <p className="text-xs text-gray-500">Driving License</p>
                                                    <Dialog>
                                                        <DialogTrigger onClick={() => handleViewDocument(driver.driving_license_url)}>
                                                            <div className="w-32 h-20 bg-[#222] rounded border border-[#444] overflow-hidden cursor-zoom-in hover:border-primary transition-colors relative group">
                                                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <span className="text-xs text-white font-bold">View License</span>
                                                                </div>
                                                                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                                                                    <span className="opacity-50">Click to View</span>
                                                                </div>
                                                            </div>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-3xl bg-black border-[#333] p-0 overflow-hidden">
                                                            <div className="p-4 flex justify-center bg-[#111]">
                                                                {selectedImage ? (
                                                                    <img src={selectedImage} className="max-h-[80vh] w-auto object-contain" />
                                                                ) : <div className="p-10 text-center"><Loader2 className="animate-spin" /></div>}
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                </div>

                                                {/* Carte Grise */}
                                                <div className="space-y-2">
                                                    <p className="text-xs text-gray-500">Carte Grise</p>
                                                    <Dialog>
                                                        <DialogTrigger onClick={() => handleViewDocument(driver.carte_grise_url)}>
                                                            <div className="w-32 h-20 bg-[#222] rounded border border-[#444] overflow-hidden cursor-zoom-in hover:border-primary transition-colors relative group">
                                                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <span className="text-xs text-white font-bold">View Doc</span>
                                                                </div>
                                                                <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                                                                    <span className="opacity-50">Click to View</span>
                                                                </div>
                                                            </div>
                                                        </DialogTrigger>
                                                        <DialogContent className="max-w-3xl bg-black border-[#333] p-0 overflow-hidden">
                                                            <div className="p-4 flex justify-center bg-[#111]">
                                                                {selectedImage ? (
                                                                    <img src={selectedImage} className="max-h-[80vh] w-auto object-contain" />
                                                                ) : <div className="p-10 text-center"><Loader2 className="animate-spin" /></div>}
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex flex-col gap-2 justify-center min-w-[140px]">
                                                <Button className="bg-green-600 hover:bg-green-700 w-full" onClick={() => verifyDriver(driver.id, true)}>
                                                    Approve ✅
                                                </Button>
                                                <Button variant="destructive" className="bg-red-900/30 text-red-500 hover:bg-red-900/50 w-full" onClick={() => verifyDriver(driver.id, false)}>
                                                    Reject ❌
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

export default AdminDashboard;
