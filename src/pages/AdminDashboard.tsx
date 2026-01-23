
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

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        checkAdmin();
        fetchDrivers();
    }, []);

    const checkAdmin = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            navigate("/admin");
            return;
        }
    };

    const fetchDrivers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'driver')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDrivers(data || []);
        } catch (error) {
            console.error("Error fetching drivers:", error);
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
                variant: !currentStatus ? "default" : "destructive" // Green for activate? Destructive for ban
            });

        } catch (error) {
            toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/admin");
    };

    const filteredDrivers = drivers.filter(d =>
        d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.phone?.includes(search) ||
        d.license_plate?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                        <ShieldCheck className="text-primary w-6 h-6" />
                    </div>
                    <h1 className="font-bold text-xl text-gray-800">Taxi DZ Admin</h1>
                </div>
                <Button variant="outline" onClick={handleLogout} className="gap-2">
                    <LogOut className="w-4 h-4" /> Logout
                </Button>
            </header>

            {/* Main Content */}
            <main className="p-6 max-w-7xl mx-auto space-y-6">
                {/* Stats / Overview could go here */}

                {/* Drivers List */}
                <Card className="p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <h2 className="text-lg font-bold">Driver Management</h2>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                placeholder="Search name, phone, or plate..."
                                className="pl-10"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Driver</TableHead>
                                        <TableHead>Vehicle Info</TableHead>
                                        <TableHead>License Plate</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredDrivers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center h-32 text-gray-500">
                                                No drivers found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredDrivers.map((driver) => (
                                            <TableRow key={driver.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                                                            {driver.profile_image ? (
                                                                <img src={driver.profile_image} alt={driver.full_name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">IMG</div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium">{driver.full_name || "Unknown"}</p>
                                                            <p className="text-xs text-gray-500">{driver.phone}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <p>{driver.car_model || "Not set"}</p>
                                                    <span className="text-xs text-gray-500 capitalize">{driver.work_type}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-mono bg-gray-50">
                                                        {driver.license_plate || "MISSING"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {driver.is_verified ? (
                                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none gap-1">
                                                            <CheckCircle className="w-3 h-3" /> Active
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none gap-1">
                                                            <Loader2 className="w-3 h-3" /> Pending
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant={driver.is_verified ? "destructive" : "default"}
                                                        className={driver.is_verified ? "bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 shadow-none" : "bg-green-600 hover:bg-green-700"}
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
                    )}
                </Card>
            </main>
        </div>
    );
};

export default AdminDashboard;
