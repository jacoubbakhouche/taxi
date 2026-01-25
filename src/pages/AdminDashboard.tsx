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

    // Server-Side Data State
    const [users, setUsers] = useState<any[]>([]);
    const [stats, setStats] = useState({
        total_drivers: 0,
        pending_verification: 0,
        active_subscriptions: 0,
        expired_subscriptions: 0,
        total_revenue: 0
    });

    // Pagination & Filter State
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'expired'>('all');

    // Global Settings State
    const [premiumMode, setPremiumMode] = useState(false);

    // CRM State
    const [selectedDriver, setSelectedDriver] = useState<any | null>(null);

    // 1. Fetch KPI Stats (Fast RPC)
    const fetchStats = async () => {
        const { data, error } = await supabase.rpc('get_dashboard_kpi');
        if (data && !error) {
            setStats(data);
        }
    };

    // 2. Fetch Global Settings
    const fetchSettings = async () => {
        const { data } = await supabase.from('app_settings').select('premium_mode_enabled').single();
        if (data) setPremiumMode(data.premium_mode_enabled);
    };

    // 3. Fetch Users Paginated (Smart RPC)
    const fetchUsers = async () => {
        setLoading(true);
        try {
            console.log(`Fetching page ${page} with filter ${statusFilter}...`);

            const { data, error } = await supabase.rpc('get_admin_users_paginated', {
                page_number: page,
                page_size: 20,
                search_query: search,
                status_filter: statusFilter
            });

            if (error) throw error;

            console.log("Fetched users:", data?.length);
            setUsers(data || []);

            // Get total count from first row (window function)
            if (data && data.length > 0) {
                setTotalCount(data[0].total_count);
            } else {
                setTotalCount(0); // No results
            }

        } catch (error: any) {
            console.error("Error:", error);
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // Effects
    useEffect(() => {
        checkAdmin();
        fetchStats();
        fetchSettings();
    }, []); // Init only

    useEffect(() => {
        // Debounce search could go here, but for now direct call
        const timer = setTimeout(() => {
            fetchUsers();
        }, 300);
        return () => clearTimeout(timer);
    }, [page, search, statusFilter]);

    const checkAdmin = async () => {
        // Direct Access Mode: No strict auth check
        // if (!session) navigate("/admin");
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/admin");
    };

    const handleEnforcePremiumReset = async () => {
        if (!confirm("⚠️ ENFORCE PREMIUM RESET? ⚠️\n\nThis will:\n1. KICK OUT all drivers.\n2. ERASE their current verification.\n3. FORCE them to re-upload documents & pay.\n\nAre you sure?")) return;
        try {
            // We can keep this Client-Side for now as it's rare, or wrap in RPC.
            // Keeping as client-side update for "Suspend" logic explanation.
            await supabase.from('users')
                .update({
                    is_verified: false,
                    documents_submitted: false,
                    subscription_end_date: null,
                    driving_license_url: null,
                    carte_grise_url: null
                })
                .eq('role', 'driver');

            fetchUsers();
            fetchStats();
            toast({ title: "Premium Reset Complete", description: "All drivers evicted." });
        } catch (error) {
            toast({ title: "Error", variant: "destructive" });
        }
    };

    // Helper to calculate days left
    const getDaysLeft = (dateStr: string | null) => {
        if (!dateStr) return 0;
        const end = new Date(dateStr).getTime();
        const now = new Date().getTime();
        const diff = end - now;
        if (diff < 0) return 0;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans">
            {/* Header */}
            {/* Header */}
            <header className="bg-[#111] border-b border-[#333] p-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="text-green-500" />
                    <div>
                        <h1 className="font-bold text-lg leading-tight">Operations Center</h1>
                        <p className="text-[10px] text-gray-500">Taxi DZ Admin</p>
                    </div>
                </div>
                <div className="flex gap-4 items-center">
                    {/* Premium Mode Toggle */}
                    <div className="flex items-center gap-2 bg-[#222] p-1.5 rounded-full border border-[#333] px-3">
                        <span className={`text-xs font-bold ${!premiumMode ? 'text-green-400' : 'text-gray-500'}`}>Freemium</span>
                        <div
                            className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${premiumMode ? 'bg-red-500' : 'bg-green-600'}`}
                            onClick={async () => {
                                const newVal = !premiumMode;
                                // Optimistic UI
                                setPremiumMode(newVal);
                                // RPC Call
                                await supabase.rpc('admin_toggle_premium_mode', { enable: newVal });
                                toast({ title: newVal ? "Premium Mode ACTIVATED 🔒" : "Freemium Mode ACTIVATED 🆓", property: "System Updated" });
                            }}
                        >
                            <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${premiumMode ? 'left-6' : 'left-1'}`} />
                        </div>
                        <span className={`text-xs font-bold ${premiumMode ? 'text-red-400' : 'text-gray-500'}`}>Premium</span>
                    </div>

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
                            onClick={() => { setStatusFilter('all'); setPage(1); }}
                            className={`flex flex-col items-start p-3 rounded-lg border min-w-[140px] transition-all ${statusFilter === 'all' ? 'bg-[#222] border-green-500/50' : 'bg-[#111] border-[#333] hover:border-[#444]'}`}
                        >
                            <span className="text-xs text-gray-500">All Drivers</span>
                            <span className="text-xl font-bold text-white">{stats.total_drivers}</span>
                        </button>

                        <button
                            onClick={() => { setStatusFilter('pending'); setPage(1); }}
                            className={`flex flex-col items-start p-3 rounded-lg border min-w-[140px] transition-all ${statusFilter === 'pending' ? 'bg-[#2a1a1a] border-yellow-500/50' : 'bg-[#111] border-[#333] hover:border-[#444]'}`}
                        >
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                Pending {stats.pending_verification > 0 && <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
                            </span>
                            <span className="text-xl font-bold text-white">{stats.pending_verification}</span>
                        </button>

                        <button
                            onClick={() => { setStatusFilter('expired'); setPage(1); }}
                            className={`flex flex-col items-start p-3 rounded-lg border min-w-[140px] transition-all ${statusFilter === 'expired' ? 'bg-red-950/30 border-red-500/80 ring-1 ring-red-500/20' : 'bg-[#111] border-[#333] hover:border-[#444]'}`}
                        >
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                Expired / Unpaid {stats.expired_subscriptions > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
                            </span>
                            <span className="text-xl font-bold text-white">{stats.expired_subscriptions}</span>
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
                                <TableHead className="text-gray-400 text-right">Commission</TableHead>
                                <TableHead className="text-gray-400">Vehicle</TableHead>
                                <TableHead className="text-gray-400 text-right">Joined</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                                        Loading Operations Center...
                                    </TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                                        No drivers found in this view.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map(user => (
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
                                            {(() => {
                                                // ADMIN VIEW LOGIC (The Judge Mirror)
                                                // 1. Suspended?
                                                if (user.is_suspended) return <Badge variant="destructive">Suspended</Badge>;

                                                // 2. Freemium?
                                                if (!premiumMode) return <Badge className="bg-green-900/30 text-green-400 border-green-900">Active (Free)</Badge>;

                                                // 3. Documents Missing? (Premium only)
                                                if (!user.documents_submitted && !user.is_verified) return <Badge variant="outline" className="text-gray-500">New / No Docs</Badge>;

                                                // 4. Pending Approval?
                                                // Using strict check for documents_submitted to be true
                                                if (!user.is_verified && user.documents_submitted === true) return <Badge className="bg-yellow-900/30 text-yellow-400 border-yellow-900 animate-pulse">Needs Approval</Badge>;

                                                // Double check if data might be stale or RPC mismatch (fallback)
                                                if (!user.is_verified && user.documents_submitted) return <Badge className="bg-yellow-900/30 text-yellow-400 border-yellow-900 animate-pulse">Needs Approval</Badge>;

                                                // 5. Subscription Check (Premium only)
                                                // Use helper to check validity
                                                const daysLeft = getDaysLeft(user.subscription_end_date);
                                                const subValid = user.subscription_end_date && new Date(user.subscription_end_date) > new Date();

                                                if (!subValid) return <Badge className="bg-red-950/50 text-red-500 border-red-900">Expired / Unpaid</Badge>;

                                                // 6. Active
                                                return <Badge className="bg-green-900/30 text-green-400 border-green-900">Active</Badge>;
                                            })()}
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
                                        <TableCell className="text-right">
                                            {user.role === 'driver' && (
                                                <span className={`font-mono font-bold ${(user.accumulated_commission || 0) > 1000 ? "text-red-500" : "text-gray-400"}`}>
                                                    {(user.accumulated_commission || 0).toLocaleString()} DA
                                                </span>
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
