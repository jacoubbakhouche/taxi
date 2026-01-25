
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Car, ArrowLeft, Loader2, CheckCircle } from "lucide-react";

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

      // Check Profile
      const { data: profile } = await supabase
        .from('users')
        .select('is_driver_registered, full_name, phone')
        .eq('auth_id', session.user.id)
        .single();

      if (profile?.is_driver_registered) {
        navigate("/driver/dashboard");
      } else {
        // Logged in but NOT functionality a driver yet
        // Pre-fill form if data exists (e.g. from Customer profile)
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
        options: {
          redirectTo: `${window.location.origin}/driver/auth`, // Redirect back here to check status
        },
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

      // 1. Call Secure RPC to Complete Profile
      // This bypasses RLS issues by running on the server with elevated privileges
      const { error: rpcError } = await supabase.rpc('complete_driver_profile', {
        p_full_name: fullName,
        p_phone: phone
      });

      if (rpcError) {
        console.error("RPC Failed", rpcError);
        throw rpcError;
      }

      toast({ title: "Welcome to the Fleet! 🚕", description: "Registration successful." });
      navigate("/driver/dashboard");

    } catch (error: any) {
      toast({ title: "Registration Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#84cc16]/5 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      <Card className="w-full max-w-md bg-[#1A1A1A] border border-[#333] shadow-2xl p-8 space-y-8 relative z-10 animate-in fade-in zoom-in duration-500">

        {view === 'login' ? (
          <>
            <button onClick={() => navigate("/role-selection")} className="absolute top-6 left-6 text-[#666] hover:text-white">
              <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="flex flex-col items-center space-y-4 pt-4">
              <div className="w-20 h-20 rounded-2xl bg-[#222] border border-[#333] flex items-center justify-center shadow-lg mb-2">
                <Car className="w-10 h-10 text-[#84cc16]" />
              </div>
              <div className="text-center space-y-1">
                <h1 className="text-2xl font-bold tracking-tight text-white">Driver Portal</h1>
                <p className="text-sm text-[#888]">Join the best fleet in town</p>
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
                  Continue with Google
                </>
              )}
            </Button>
          </>
        ) : (
          <form onSubmit={handleCompleteRegistration} className="space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-[#84cc16]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-[#84cc16]" />
              </div>
              <h2 className="text-xl font-bold text-white">Final Step</h2>
              <p className="text-sm text-gray-400">Complete your profile to start driving</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="uppercase text-xs font-bold text-gray-500 ml-1">Full Name</Label>
                <Input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="bg-[#111] border-[#333] h-12 text-lg"
                  placeholder="e.g. Mohammed Amine"
                  required
                />
              </div>

              <div>
                <Label className="uppercase text-xs font-bold text-gray-500 ml-1">Phone Number</Label>
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="bg-[#111] border-[#333] h-12 text-lg font-mono"
                  placeholder="055 123 4567"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-[#84cc16] hover:bg-[#72b313] text-black font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(132,204,22,0.3)] transition-all"
            >
              {loading ? <Loader2 className="animate-spin" /> : "Complete Registration"}
            </Button>
          </form>
        )}

      </Card>
    </div>
  );
};

export default DriverAuth;
