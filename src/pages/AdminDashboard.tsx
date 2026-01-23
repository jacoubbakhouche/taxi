import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LogOut, Search, ShieldCheck, CheckCircle, XCircle, Trash2, User, Car } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterRole, setFilterRole] = useState<"all" | "driver" | "customer">("driver");

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
        if (!session) {
            navigate("/admin");
            return;
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/admin");
    };

    const toggleVerification = async (id: string, currentStatus: boolean) => {
        try {
            const newStatus = !currentStatus;

            // If we are Unverifying (Active -> Inactive), we typically want them to RE-UPLOAD documents.
            // So we reset their document status too.
            const updates = newStatus
                ? { is_verified: true } // activating
                : { // deactivating - reset checks
                    is_verified: false,
                    documents_submitted: false,
                    driving_license_url: null,
                    carte_grise_url: null
                };

            const { error } = await supabase.from('users').update(updates).eq('id', id);

            if (error) throw error;

            // Update local state
            setUsers(users.map(u => u.id === id ? { ...u, ...updates } : u));

            toast({
                title: newStatus ? "Driver Verified" : "Driver Rejected",
                description: newStatus ? "Driver is now active." : "Driver has been reset and must re-upload docs.",
                variant: newStatus ? "default" : "destructive"
            });
        } catch (error) {
            toast({ title: "Error", description: "Failed to update", variant: "destructive" });
        }
    };

    const resetSystem = async () => {
        if (!confirm("RESET ALL DRIVERS? They will need to re-upload documents.")) return;
        try {
            const { error } = await supabase.from('users')
                .update({ is_verified: false, documents_submitted: false, driving_license_url: null, carte_grise_url: null })
                .eq('role', 'driver');
            if (error) throw error;
            fetchUsers(); // Refresh
            toast({ title: "System Reset", description: "All drivers deactivated." });
        } catch (error) {
            toast({ title: "Error", variant: "destructive" });
        }
    };

    // Filter Logic
    const filteredUsers = users.filter(user => {
        const matchesSearch = (
            user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            user.phone?.includes(search) ||
            user.email?.toLowerCase().includes(search.toLowerCase())
        );
        const matchesRole = filterRole === "all" || user.role === filterRole;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="min-h-screen bg-black text-white font-sans">
            {/* Header */}
            <header className="bg-[#111] border-b border-[#333] p-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="text-green-500" />
                    <h1 className="font-bold text-lg">Admin Control</h1>
                </div>
                <div className="flex gap-2">
                    <Button variant="destructive" size="sm" onClick={resetSystem}>
                        <XCircle className="w-4 h-4 mr-1" /> Reset All
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleLogout} className="text-white border-[#444]">
                        <LogOut className="w-4 h-4 mr-1" /> Logout
                    </Button>
                </div>
            </header>

            {/* Content */}
            <main className="p-4 max-w-7xl mx-auto space-y-4">

                {/* Controls */}
                <div className="flex flex-col md:flex-row gap-4 justify-between bg-[#111] p-4 rounded-lg border border-[#333]">
                    <div className="flex gap-2 items-center">
                        <div className="bg-green-900/20 text-green-500 px-3 py-1 rounded-md border border-green-900/50 flex items-center gap-2">
                            <Car className="w-4 h-4" />
                            <span className="font-bold">Total Drivers: {filteredUsers.length}</span>
                        </div>
                    </div>
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                            placeholder="Search name, phone..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-[#222] border-[#444] text-white pl-10"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-lg border border-[#333] overflow-hidden">
                    <Table>
                        <TableHeader className="bg-[#1A1A1A]">
                            <TableRow className="border-[#333]">
                                <TableHead className="text-gray-400">User</TableHead>
                                <TableHead className="text-gray-400">Role</TableHead>
                                <TableHead className="text-gray-400">Vehicle / Docs</TableHead>
                                <TableHead className="text-gray-400">Status</TableHead>
                                <TableHead className="text-right text-gray-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-gray-500">Loading...</TableCell>
                                </TableRow>
                            ) : filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-gray-500">No users found.</TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map(user => (
                                    <TableRow key={user.id} className="border-[#333] hover:bg-[#1A1A1A]">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center overflow-hidden">
                                                    {user.profile_image ? (
                                                        <img src={user.profile_image} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-xs text-gray-500">{user.full_name?.[0] || "?"}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold">{user.full_name || "No Name"}</p>
                                                    <p className="text-xs text-gray-400">{user.phone}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize border-[#444] text-gray-300">
                                                {user.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {user.role === 'driver' ? (
                                                <div className="space-y-1">
                                                    <p className="text-xs text-gray-400">{user.car_model} • {user.license_plate}</p>
                                                    <div className="flex gap-2">
                                                        {user.driving_license_url && (
                                                            <Dialog>
                                                                <DialogTrigger><span className="text-[10px] bg-[#222] px-2 py-1 rounded border border-[#444] cursor-pointer hover:border-green-500">License</span></DialogTrigger>
                                                                <DialogContent className="bg-black border-[#333] p-0"><img src={user.driving_license_url} className="w-full" /></DialogContent>
                                                            </Dialog>
                                                        )}
                                                        {user.carte_grise_url && (
                                                            <Dialog>
                                                                <DialogTrigger><span className="text-[10px] bg-[#222] px-2 py-1 rounded border border-[#444] cursor-pointer hover:border-green-500">Car Doc</span></DialogTrigger>
                                                                <DialogContent className="bg-black border-[#333] p-0"><img src={user.carte_grise_url} className="w-full" /></DialogContent>
                                                            </Dialog>
                                                        )}
                                                        {!user.driving_license_url && !user.carte_grise_url && <span className="text-[10px] text-red-500">No Docs</span>}
                                                    </div>
                                                </div>
                                            ) : <span className="text-gray-600">-</span>}
                                        </TableCell>
                                        <TableCell>
                                            {user.is_verified ? (
                                                <Badge className="bg-green-900/40 text-green-400 border-green-900">Verified</Badge>
                                            ) : (
                                                <Badge className="bg-red-900/40 text-red-400 border-red-900">Pending</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {user.role === 'driver' && (
                                                <Button
                                                    size="sm"
                                                    variant={user.is_verified ? "destructive" : "default"}
                                                    className={user.is_verified ? "h-8" : "bg-green-600 h-8"}
                                                    onClick={() => toggleVerification(user.id, user.is_verified)}
                                                >
                                                    {user.is_verified ? "Unverify" : "Verify"}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
