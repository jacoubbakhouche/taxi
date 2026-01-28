import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CreditCard, AlertTriangle, Calendar, CheckCircle, Car, Star, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const DriverFinancials = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [driver, setDriver] = useState<any>(null);
    const [error, setError] = useState(false);
    const [totalEarnings, setTotalEarnings] = useState(0);

    useEffect(() => {
        fetchDriverStatus();
    }, []);

    const fetchDriverStatus = async () => {
        setLoading(true);
        setError(false);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate("/driver/auth");
                return;
            }

            const { data, error } = await supabase
                .from("users")
                .select("*")
                .eq("auth_id", session.user.id)
                .single();

            if (error) throw error;
            setDriver(data);

            // Fetch Rides for Earnings Calc
            const { data: rides, error: ridesError } = await supabase
                .from("rides")
                .select("price, status")
                .eq("driver_id", data.id)
                .eq("status", "completed");

            if (rides) {
                const earnings = rides.reduce((sum, ride) => sum + (ride.price || 0), 0);
                setTotalEarnings(earnings);
            }

        } catch (error) {
            console.error(error);
            setError(true);
            toast({ title: "خطأ في الاتصال", description: "تعذر تحميل البيانات المالية، يرجى التحقق من الإنترنت.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center text-white gap-4">
            <div className="w-10 h-10 border-4 border-[#84cc16] border-t-transparent rounded-full animate-spin"></div>
            <p>جاري التحميل...</p>
        </div>
    );

    if (error || !driver) return (
        <div className="min-h-screen bg-[#111] flex flex-col items-center justify-center text-white p-6 text-center space-y-4">
            <div className="bg-red-500/10 p-4 rounded-full">
                <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl font-bold">فشل في الاتصال</h2>
            <p className="text-gray-400">يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.</p>
            <Button onClick={fetchDriverStatus} className="bg-[#84cc16] text-black hover:bg-[#72b013] min-w-[150px]">
                إعادة المحاولة
            </Button>
            <Button variant="ghost" onClick={() => navigate("/driver/dashboard")} className="text-white/60">
                العودة للرئيسية
            </Button>
        </div>
    );

    // Constants
    const COMMISSION_LIMIT = 5000;
    const commission = driver.accumulated_commission || 0;
    const progressPercent = Math.min((commission / COMMISSION_LIMIT) * 100, 100);

    // Date Calc
    const endDate = driver.subscription_end_date ? new Date(driver.subscription_end_date) : null;
    const now = new Date();
    const daysLeft = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const isExpired = daysLeft <= 0;
    const completedRides = driver.total_rides || 0;

    return (
        <div className="min-h-screen bg-[#111111] pb-8 relative font-sans" dir="rtl">
            {/* Header */}
            <div className="bg-[#1A1A1A] p-6 shadow-xl rounded-b-[2rem] border-b border-white/5 mb-8">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/driver/dashboard")} className="text-white hover:bg-white/10 rounded-full">
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        الوضع المالي <CreditCard className="w-6 h-6 text-[#84cc16]" />
                    </h1>
                </div>
            </div>

            <div className="px-6 space-y-6">

                {/* Stats Grid - Moved from Profile */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="glass-card p-4 rounded-2xl flex flex-col items-center justify-center text-center space-y-1 bg-[#1A1A1A] border border-white/10 shadow-lg">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-1">
                            <Car className="w-5 h-5 text-blue-500" />
                        </div>
                        <p className="text-2xl font-bold text-white">{completedRides}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">رحلات</p>
                    </div>

                    <div className="glass-card p-4 rounded-2xl flex flex-col items-center justify-center text-center space-y-1 bg-[#1A1A1A] border border-white/10 shadow-lg">
                        <div className="w-10 h-10 rounded-full bg-[#84cc16]/10 flex items-center justify-center mb-1">
                            <Star className="w-5 h-5 text-[#84cc16]" />
                        </div>
                        <p className="text-2xl font-bold text-white">{(driver.rating || 0).toFixed(1)}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">تقييم</p>
                    </div>

                    <div className="glass-card p-4 rounded-2xl flex flex-col items-center justify-center text-center space-y-1 bg-[#1A1A1A] border border-white/10 shadow-lg">
                        <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-1">
                            <DollarSign className="w-5 h-5 text-purple-500" />
                        </div>
                        <p className="text-lg font-bold text-white whitespace-nowrap">{totalEarnings > 1000 ? (totalEarnings / 1000).toFixed(1) + 'k' : totalEarnings}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">مكتسبات</p>
                    </div>
                </div>

                {/* Suspended Alert */}
                {driver.is_suspended && (
                    <Card className="bg-red-500/10 border-red-500 p-6 flex flex-col items-center text-center animate-in zoom-in spin-in-1">
                        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                        <h2 className="text-xl font-bold text-red-500 mb-2">الحساب معلق</h2>
                        <p className="text-red-300">لقد تجاوزت الحد المسموح أو انتهى اشتراكك. يرجى تسوية الوضع فوراً.</p>
                    </Card>
                )}

                {/* Card 1: Debt / Commission */}
                <Card className="bg-[#1A1A1A] border-white/10 p-6 shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-white font-bold text-lg">العمولة المستحقة</h3>
                        <span className="text-gray-400 text-sm">الحد الأقصى: {COMMISSION_LIMIT} دج</span>
                    </div>

                    <div className="mb-2 flex justify-between items-end">
                        <span className={`text-3xl font-bold ${commission > COMMISSION_LIMIT * 0.8 ? "text-red-500" : "text-white"}`}>
                            {commission.toFixed(2)} <span className="text-sm">دج</span>
                        </span>
                        <span className="text-xs text-gray-500">
                            {progressPercent.toFixed(1)}%
                        </span>
                    </div>

                    <Progress value={progressPercent} className="h-3 bg-[#333]" indicatorClassName={commission > COMMISSION_LIMIT * 0.8 ? "bg-red-500" : "bg-[#84cc16]"} />

                    <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                        يتم اقتطاع نسبة مئوية عن كل رحلة. إذا وصلت للحد الأقصى، سيتم تعليق الحساب مؤقتاً حتى الدفع.
                    </p>
                </Card>

                {/* Card 2: Subscription Time */}
                <Card className="bg-[#1A1A1A] border-white/10 p-6 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-20 h-20 bg-blue-500/10 rounded-full blur-xl -translate-x-1/2 -translate-y-1/2"></div>

                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-white font-bold text-lg mb-1">الاشتراك الشهري</h3>
                            <p className="text-sm text-gray-400">حالة الاشتراك الحالي</p>
                        </div>
                        <Calendar className="w-6 h-6 text-blue-500" />
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex-1 bg-[#222] rounded-xl p-4 text-center border border-white/5">
                            <span className="block text-3xl font-bold text-white mb-1">{daysLeft > 0 ? daysLeft : 0}</span>
                            <span className="text-xs text-gray-400">يوم متبقي</span>
                        </div>

                        <div className={`flex-1 rounded-xl p-4 text-center border ${isExpired ? "border-red-500/30 bg-red-500/10" : "border-green-500/30 bg-green-500/10"}`}>
                            <span className={`block text-lg font-bold mb-1 ${isExpired ? "text-red-500" : "text-green-500"}`}>
                                {isExpired ? "منتهي" : "نشط"}
                            </span>
                            <CheckCircle className={`w-5 h-5 mx-auto ${isExpired ? "text-red-500 opacity-50" : "text-green-500"}`} />
                        </div>
                    </div>

                    {endDate && (
                        <p className="text-xs text-center text-gray-500 mt-4">
                            ينتهي في: {endDate.toLocaleDateString('ar-DZ')}
                        </p>
                    )}
                </Card>

                {/* Action */}
                <Button className="w-full bg-[#84cc16] text-black hover:bg-[#72b013] h-12 font-bold text-lg rounded-xl shadow-lg shadow-lime-500/10">
                    اتصل للإدارة للتجديد
                </Button>

            </div>
        </div>
    );
};

export default DriverFinancials;
