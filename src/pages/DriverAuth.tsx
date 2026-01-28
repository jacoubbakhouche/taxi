import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Car, ArrowLeft, Loader2, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * DriverAuth - Rebuilt with Multi-step Onboarding (Name -> Phone)
 */
const DriverAuth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState<'login' | 'onboarding'>('login');
  const [step, setStep] = useState(1); // 1: Name, 2: Phone

  // Onboarding Data
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    checkDriverStatus();
  }, []);

  const checkDriverStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCheckingSession(false);
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('is_driver_registered, full_name, phone')
        .eq('auth_id', session.user.id)
        .single();

      if (profile?.is_driver_registered) {
        navigate("/driver/dashboard");
      } else {
        if (profile?.full_name) setFullName(profile.full_name);
        if (profile?.phone) setPhone(profile.phone);
        setView('onboarding');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCheckingSession(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/driver/auth` },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    if (!fullName.trim()) {
      toast({ title: "تنبيه", description: "يرجى كتابة اسمك", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const handleBackStep = () => {
    setStep(1);
  };

  const handleCompleteRegistration = async () => {
    if (!phone.trim()) {
      toast({ title: "تنبيه", description: "يرجى كتابة رقم الهاتف", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session found");

      const { error: rpcError } = await supabase.rpc('complete_driver_profile', {
        p_full_name: fullName,
        p_phone: phone
      });

      if (rpcError) throw rpcError;

      toast({ title: "تم التسجيل بنجاح! 🚕", description: "مرحباً بك كابتن." });
      navigate("/driver/dashboard");
    } catch (error: any) {
      toast({ title: "فشل التسجيل", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#84cc16]/5 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        <Card className="w-full max-w-md bg-[#1A1A1A] border border-[#333] shadow-2xl p-8 space-y-8 relative z-10 animate-in fade-in zoom-in duration-500">
          <button onClick={() => navigate("/role-selection")} className="absolute top-6 left-6 text-[#666] hover:text-white">
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="flex flex-col items-center space-y-4 pt-4">
            <div className="w-20 h-20 rounded-2xl bg-[#222] border border-[#333] flex items-center justify-center shadow-lg mb-2">
              <Car className="w-10 h-10 text-[#84cc16]" />
            </div>
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-white">بوابة السائقين</h1>
              <p className="text-sm text-[#888]">انضم إلى أفضل أسطول في المدينة</p>
            </div>
          </div>

          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12 bg-white hover:bg-gray-100 text-black font-bold text-lg rounded-xl flex items-center justify-center gap-3"
          >
            {loading ? <Loader2 className="animate-spin" /> : (
              <>
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                متابعة باستخدام Google
              </>
            )}
          </Button>
        </Card>
      </div>
    );
  }

  // Onboarding View (Multi-step)
  return (
    <div className="min-h-screen bg-[#121212] flex flex-col font-sans text-white" dir="rtl">
      {/* Header / Back Button */}
      <div className="p-4 pt-12 flex items-center">
        {step === 2 && (
          <Button variant="ghost" className="text-white hover:bg-white/10 rounded-full w-10 h-10 p-0" onClick={handleBackStep}>
            <ArrowRight className="w-6 h-6" />
          </Button>
        )}
      </div>

      {/* Content Container */}
      <div className="flex-1 flex flex-col px-6 pt-4 max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col h-full"
            >
              <h1 className="text-4xl font-black text-white mb-2 leading-tight">مرحباً بك كابتن! 🚕</h1>
              <p className="text-gray-400 text-lg mb-8">دعنا نبدأ بتسجيل بياناتك</p>

              <div className="space-y-2 mb-8">
                <label className="text-gray-400 text-sm font-medium">الاسم الكامل</label>
                <Input
                  autoFocus
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: أحمد محمد"
                  className="bg-[#2A2A2A] border-none text-white text-xl h-14 rounded-xl px-4 placeholder:text-white/20 focus-visible:ring-2 focus-visible:ring-[#84cc16]"
                />
              </div>

              <div className="mt-auto pb-8">
                <Button
                  className="w-full h-14 text-lg font-bold bg-[#84cc16] hover:bg-[#72b313] text-black rounded-xl transition-transform active:scale-95 shadow-[0_0_20px_rgba(132,204,22,0.3)]"
                  onClick={handleNextStep}
                >
                  التالي
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col h-full"
            >
              <h1 className="text-3xl font-black text-white mb-8">رقم هاتفك للتواصل 📱</h1>

              <div className="space-y-2 mb-8">
                <label className="text-gray-400 text-sm font-medium">رقم الهاتف</label>
                <div className="relative" dir="ltr">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold border-r border-white/10 pr-3 h-6 flex items-center">
                    🇩🇿 +213
                  </div>
                  <Input
                    autoFocus
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="5 XX XX XX XX"
                    className="bg-[#2A2A2A] border-none text-white text-xl h-14 rounded-xl pl-24 pr-4 placeholder:text-white/20 focus-visible:ring-2 focus-visible:ring-[#84cc16] font-mono"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-right">سنستخدم هذا الرقم للتواصل معك بخصوص الطلبات.</p>
              </div>

              <div className="mt-auto pb-8">
                <Button
                  className="w-full h-14 text-lg font-bold bg-[#84cc16] hover:bg-[#72b313] text-black rounded-xl transition-transform active:scale-95 shadow-[0_0_20px_rgba(132,204,22,0.3)]"
                  onClick={handleCompleteRegistration}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="animate-spin" /> : "إتمام التسجيل"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
export default DriverAuth;
