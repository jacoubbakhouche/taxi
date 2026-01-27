import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Phone } from "lucide-react";

const DriverLayout = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [driver, setDriver] = useState<any>(null);

    useEffect(() => {
        const checkStatus = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate("/driver/auth");
                return;
            }

            // Realtime subscription could be added here for instant lock
            const { data } = await supabase
                .from("users")
                .select("is_suspended, accumulated_commission, is_verified")
                .eq("auth_id", session.user.id)
                .single();

            setDriver(data);
            setLoading(false);
        };

        checkStatus();
    }, [navigate]);

    if (loading) return null; // Or a spinner

    // 1. Suspension Overlay (Blocks EVERYTHING)
    if (driver?.is_suspended) {
        return (
            <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center p-6 text-center" dir="rtl">
                <div className="bg-[#1A1A1A] border border-red-500/20 p-8 rounded-3xl max-w-sm w-full shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                    <ShieldAlert className="w-20 h-20 text-red-500 mx-auto mb-6 animate-pulse" />

                    <h1 className="text-2xl font-bold text-white mb-2">انتهى اشتراكك الشهري</h1>
                    <p className="text-gray-400 mb-6">
                        أو تجاوزت الحد الأقصى للديون. لا يمكنك استقبال طلبات جديدة حتى تقوم بتسوية الوضع.
                    </p>

                    <div className="bg-red-500/10 rounded-xl p-4 mb-8 border border-red-500/10">
                        <span className="block text-sm text-red-400 mb-1">المبلغ المستحق (تقريباً)</span>
                        <span className="text-3xl font-bold text-white">{driver.accumulated_commission || 0} دج</span>
                    </div>

                    <Button
                        className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white h-14 text-lg font-bold rounded-xl gap-2 shadow-lg"
                        onClick={() => window.open("https://wa.me/213555555555", "_blank")}
                    >
                        <Phone className="w-5 h-5" />
                        تواصل مع الإدارة للدفع
                    </Button>

                    <button onClick={() => navigate('/')} className="mt-6 text-gray-600 text-sm hover:text-white underline">
                        تسجيل الخروج
                    </button>
                </div>
            </div>
        );
    }

    // 2. Normal Render
    return (
        <div className="min-h-screen bg-background">
            <Outlet />
        </div>
    );
};

export default DriverLayout;
