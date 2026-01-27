import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, CheckCircle, Smartphone } from "lucide-react";

/**
 * DriverAuth - Reimagined with new Hero Style
 */
const DriverAuth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState<'login' | 'onboarding'>('login');

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

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session found");

      const { error: rpcError } = await supabase.rpc('complete_driver_profile', {
        p_full_name: fullName,
        p_phone: phone
      });

      if (rpcError) throw rpcError;

      toast({ title: "Welcome to the Fleet! 🚕", description: "Registration successful." });
      navigate("/driver/dashboard");
    } catch (error: any) {
      toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin text-[#84cc16]" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#111] flex flex-col relative overflow-hidden font-sans">

      {/* --- HERO IMAGE SECTION (TOP) --- */}
      <div className="h-[45vh] relative w-full overflow-hidden">
        {/* The New Image */}
        <img
          src="/images/driver_welcome_hero.png"
          alt="Driver Welcome"
          className="w-full h-full object-cover object-center"
        />
        {/* Gradient Overlay for smooth transition */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent"></div>

        <button onClick={() => navigate("/role-selection")} className="absolute top-6 left-6 z-10 w-10 h-10 bg-black/30 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-black/50 transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* --- CONTENT SECTION (BOTTOM SHEET) --- */}
      <div className="flex-1 -mt-10 bg-[#1A1A1A] rounded-t-[2.5rem] border-t border-white/5 relative z-10 p-8 flex flex-col items-center animate-in slide-in-from-bottom-20 duration-700 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">

        {/* Handle Decorator */}
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mb-8 opacity-50"></div>

        {view === 'login' ? (
          <div className="w-full max-w-sm flex flex-col justify-between h-full pb-8">
            <div className="space-y-4 text-center">
              <h1 className="text-3xl font-bold text-white tracking-tight">
                ابدأ رحلتك <span className="text-[#84cc16]">الخضراء</span>
              </h1>
              <p className="text-gray-400 text-lg leading-relaxed">
                انضم لأفضل شبكة سائقين في الجزائر. مكاسب عالية، وقت مرن، وتجربة احترافية.
              </p>
            </div>

            <div className="space-y-4 mt-8">
              <Button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-14 bg-white hover:bg-gray-100 text-black font-bold text-lg rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-transform hover:scale-[1.02] active:scale-95"
              >
                {loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
                    المتابعة باستخدام Google
                  </>
                )}
              </Button>

              <div className="text-center">
                <p className="text-xs text-gray-600 mt-4">
                  بالتسجيل، أنت توافق على شروط الخدمة وسياسة الخصوصية
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleCompleteRegistration} className="w-full max-w-sm space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">بيانات السائق</h2>
              <p className="text-sm text-[#84cc16]">خطوة أخيرة للبدء</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-400 text-xs uppercase font-bold pr-1">الاسم الكامل</Label>
                <div className="relative">
                  <Input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="bg-[#111] border-[#333] h-14 pr-4 pl-10 text-lg rounded-xl focus:border-[#84cc16] transition-colors text-right"
                    placeholder="محمد أمين"
                    dir="rtl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-400 text-xs uppercase font-bold pr-1">رقم الهاتف</Label>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                  <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="bg-[#111] border-[#333] h-14 pl-12 text-lg font-mono rounded-xl focus:border-[#84cc16] transition-colors text-left"
                    placeholder="055 123 4567"
                    required
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-[#84cc16] hover:bg-[#72b313] text-black font-bold text-xl rounded-2xl shadow-[0_0_30px_rgba(132,204,22,0.2)] mt-8 transition-transform hover:scale-[1.02]"
            >
              {loading ? <Loader2 className="animate-spin" /> : "إتمام التسجيل"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default DriverAuth;
