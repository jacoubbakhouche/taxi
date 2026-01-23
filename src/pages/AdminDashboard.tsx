import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LogOut, Search, ShieldCheck, CheckCircle, XCircle, Trash2, User, Car, Filter, AlertCircle, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { DriverDetailDrawer } from "@/components/admin/DriverDetailDrawer";

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // CRM State
    const [selectedDriver, setSelectedDriver] = useState<any | null>(null);
    const [showPendingOnly, setShowPendingOnly] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            console.log("Fetching users...");
            // Fetch ALL users to be safe, then filter in UI to avoid RLS confusion
            // Also helps debug if 'role' is wrong
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            console.log("Fetched users:", data?.length);
            setUsers(data || []);
        } catch (error: any) {
            console.error("Error:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAdmin();
        fetchUsers();
    }, []);

    const checkAdmin = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        // Direct Access Mode: No strict auth check
        // if (!session) navigate("/admin");
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/admin");
    };

    // Filter Logic
    const filteredUsers = users.filter(user => {
        // 1. Base Filter: Must be Driver
        if (user.role !== 'driver') return false;

        // 2. Search Filter
        const matchesSearch = (
            user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            user.phone?.includes(search) ||
            user.email?.toLowerCase().includes(search.toLowerCase())
        );

        // 3. Pending Filter (Action Center)
        // Pending = Needs Action = submitted docs but not verified yet.
        // Or if they are verified, we don't show them in "Pending Only" mode.
        if (showPendingOnly) {
            return matchesSearch && (!user.is_verified && user.documents_submitted);
        }

        return matchesSearch;
    });

    // Helper for Pending Count
    const pendingCount = users.filter(u => u.role === 'driver' && !u.is_verified && u.documents_submitted).length;

    // Helper to calculate days left
    const getDaysLeft = (dateStr: string | null) => {
        if (!dateStr) return 0;
        const end = new Date(dateStr).getTime();
        const now = new Date().getTime();
        const diff = end - now;
        if (diff < 0) return 0;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const enforcePremiumReset = async () => {
        if (!confirm("⚠️ ENFORCE PREMIUM RESET? ⚠️\n\nThis will:\n1. KICK OUT all drivers.\n2. ERASE their current verification.\n3. FORCE them to re-upload documents & pay.\n\nAre you sure?")) return;
        try {
            const { error } = await supabase.from('users')
                .update({
                    is_verified: false,
                    documents_submitted: false,
                    subscription_end_date: null,
                    driving_license_url: null,
                    carte_grise_url: null
                })
                .eq('role', 'driver');

            if (error) throw error;
            fetchUsers();
            toast({ title: "Premium Reset Complete", description: "All drivers evicted. Entry requires new docs + payment." });
        } catch (error) {
            toast({ title: "Error", variant: "destructive" });
        }
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans">
            {/* Header */}
            <header className="bg-[#111] border-b border-[#333] p-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="text-green-500" />
                    <div>
                        <h1 className="font-bold text-lg leading-tight">Operations Center</h1>
                        <p className="text-[10px] text-gray-500">Taxi DZ Admin</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={enforcePremiumReset} className="text-white border-red-500/50 bg-red-900/40 hover:bg-red-600 font-bold animate-pulse">
                        <AlertTriangle className="w-4 h-4 mr-2" /> Enforce Premium Mode
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleLogout} className="text-white border-[#444] hover:bg-[#222]">
                        <LogOut className="w-4 h-4 mr-1" /> Logout
                    </Button>
                </div>
            </header>

            {/* Action Center Bar */}
            <div className="bg-[#0f0f0f] border-b border-[#333] p-4">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 justify-between items-center">

                    {/* KPI / Filter Toggles */}
                    <div className="flex gap-4 w-full md:w-auto overflow-x-auto">
                        <button
                            onClick={() => setShowPendingOnly(false)}
                            className={`flex flex-col items-start p-3 rounded-lg border min-w-[140px] transition-all ${!showPendingOnly ? 'bg-[#222] border-green-500/50' : 'bg-[#111] border-[#333] hover:border-[#444]'}`}
                        >
                            <span className="text-xs text-gray-500">All Drivers</span>
                            <span className="text-xl font-bold text-white">{users.filter(u => u.role === 'driver').length}</span>
                        </button>

                        <button
                            onClick={() => setShowPendingOnly(true)}
                            className={`flex flex-col items-start p-3 rounded-lg border min-w-[140px] transition-all ${showPendingOnly ? 'bg-[#2a1a1a] border-red-500/50' : 'bg-[#111] border-[#333] hover:border-[#444]'}`}
                        >
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                Pending {pendingCount > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                            </span>
                            <span className="text-xl font-bold text-white">{pendingCount}</span>
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            placeholder="Search drivers..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-[#111] border-[#333] text-white pl-10 focus:border-green-500 transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <main className="p-4 max-w-7xl mx-auto">
                <div className="rounded-lg border border-[#333] overflow-hidden bg-[#111]">
                    <Table>
                        <TableHeader className="bg-[#1A1A1A]">
                            <TableRow className="border-[#333] hover:bg-[#1A1A1A]">
                                <TableHead className="text-gray-400 w-[300px]">Driver</TableHead>
                                <TableHead className="text-gray-400">Status</TableHead>
                                <TableHead className="text-gray-400">Subscription</TableHead>
                                <TableHead className="text-gray-400">Vehicle</TableHead>
                                <TableHead className="text-gray-400 text-right">Joined</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                                        Loading Operations Center...
                                    </TableCell>
                                </TableRow>
                            ) : filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                                        No drivers found in this view.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map(user => (
                                    <TableRow
                                        key={user.id}
                                        className="border-[#333] hover:bg-[#222] cursor-pointer group transition-colors"
                                        onClick={() => setSelectedDriver(user)}
                                    >
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center overflow-hidden border border-gray-700 group-hover:border-gray-500 transition-colors">
                                                    {user.profile_image ? (
                                                        <img src={user.profile_image} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs text-gray-500">{user.full_name?.[0] || "?"}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm group-hover:text-green-400 transition-colors">{user.full_name || "Unknown Driver"}</p>
                                                    <p className="text-xs text-gray-500">{user.phone}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {user.is_verified ? (
                                                <Badge className="bg-green-900/30 text-green-400 border-green-900 hover:bg-green-900/50">
                                                    Active
                                                </Badge>
                                            ) : user.documents_submitted ? (
                                                <Badge className="bg-yellow-900/30 text-yellow-400 border-yellow-900 hover:bg-yellow-900/50 animate-pulse">
                                                    Needs Approval
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="border-[#444] text-gray-500" title="Free Entry / Inactive">
                                                    {user.subscription_end_date ? "Unknown" : "Free Ent."}
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {user.role === 'driver' && (
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-mono ${getDaysLeft(user.subscription_end_date) > 5 ? "text-green-400" : "text-gray-500"}`}>
                                                        {user.subscription_end_date ? `${getDaysLeft(user.subscription_end_date)} Days` : "No Sub (Free)"}
                                                    </span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm text-gray-300">
                                                {user.car_model || "-"}
                                                <span className="text-xs text-gray-500 block">{user.license_plate}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-gray-500">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </main>

            {/* Slider Drawer */}
            <DriverDetailDrawer
                driver={selectedDriver}
                open={!!selectedDriver}
                onClose={() => setSelectedDriver(null)}
                onUpdate={fetchUsers}
            />
        </div>
    );
};

export default AdminDashboard;
