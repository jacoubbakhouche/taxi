
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const AdminAuth = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Check if user is actually admin
            const { data: user } = await supabase
                .from('users')
                .select('is_admin')
                .eq('auth_id', data.session.user.id)
                .single();

            if (!user?.is_admin) {
                toast({
                    title: "Access Denied",
                    description: "This account does not have admin privileges.",
                    variant: "destructive",
                });
                await supabase.auth.signOut();
                return;
            }

            toast({
                title: "Welcome Admin",
                description: "Login successful",
            });
            navigate("/admin/dashboard");
        } catch (error: any) {
            toast({
                title: "Login Failed",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4">
            <Card className="w-full max-w-md shadow-xl bg-[#111] border-[#333]">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <ShieldCheck className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">Admin Portal</CardTitle>
                    <p className="text-sm text-gray-400">Authorized personnel only</p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-200">Email</label>
                            <Input
                                type="email"
                                placeholder="admin@taxi.dz"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="bg-[#222] border-[#444] text-white placeholder:text-gray-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-200">Password</label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="bg-[#222] border-[#444] text-white placeholder:text-gray-500"
                            />
                        </div>
                        <Button className="w-full" type="submit" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin mr-2" /> : "Secure Login"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default AdminAuth;
