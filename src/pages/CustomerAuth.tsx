
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { User, ArrowLeft, Loader2 } from "lucide-react";

const CustomerAuth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/customer/dashboard");
      }
    };
    checkSession();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/customer/dashboard`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#84cc16]/5 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      <Card className="w-full max-w-md bg-[#1A1A1A] border border-[#333] shadow-2xl p-8 space-y-8 relative z-10">

        <button
          onClick={() => navigate("/role-selection")}
          className="absolute top-6 left-6 p-2 rounded-full hover:bg-white/5 text-[#666] transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center space-y-4 pt-4">
          <div className="w-20 h-20 rounded-2xl bg-[#222] border border-[#333] flex items-center justify-center shadow-lg mb-2">
            <User className="w-10 h-10 text-[#84cc16]" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">Passenger Login</h1>
            <p className="text-sm text-[#888]">Continue to start your ride</p>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12 bg-white hover:bg-gray-100 text-black font-bold text-lg rounded-xl flex items-center justify-center gap-3 transition-all"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                Continue with Google
              </>
            )}
          </Button>
        </div>

        <div className="text-center text-[#444] text-xs">
          Secure Access • Taxi DZ
        </div>
      </Card>
    </div>
  );
};

export default CustomerAuth;
