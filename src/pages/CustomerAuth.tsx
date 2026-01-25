
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { User, ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  fullName: z.string().min(3, "الاسم يجب أن يكون 3 أحرف على الأقل"),
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  phone: z.string().min(10, "رقم الهاتف غير صحيح"),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل"),
});

const CustomerAuth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!isLogin) {
        const validated = authSchema.parse(formData);

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: validated.email,
          password: validated.password,
          options: {
            emailRedirectTo: `${window.location.origin}/customer/dashboard`,
          },
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: userError } = await supabase
            .from("users")
            .insert({
              auth_id: authData.user.id,
              full_name: validated.fullName,
              phone: validated.phone,
              role: "customer",
            });

          if (userError) throw userError;

          toast({
            title: "تم التسجيل بنجاح",
            description: "مرحباً بك في Taxi DZ",
          });
          navigate("/customer/dashboard");
        }
      } else {
        const { data: { user }, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) throw error;

        // Force Role Check
        if (user) {
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('role')
            .eq('auth_id', user.id)
            .single();

          if (profileError || !userProfile || userProfile.role !== 'customer') {
            await supabase.auth.signOut();
            throw new Error("هذا الحساب خاص بالسائقين، يرجى استخدام تطبيق السائق / This is a driver account");
          }
        }

        toast({
          title: "تم تسجيل الدخول بنجاح",
          description: "أهلاً بعودتك",
        });
        navigate("/customer/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ ما",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">

      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#84cc16]/5 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      <Card className="w-full max-w-md bg-[#1A1A1A] border border-[#333] shadow-2xl p-8 space-y-8 relative z-10 animate-in fade-in zoom-in duration-500">

        {/* Header Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="w-full flex justify-between items-start absolute top-6 left-6 right-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/role-selection")}
              className="text-[#666] hover:text-white hover:bg-white/5 rounded-full"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </div>

          <div className="w-20 h-20 rounded-2xl bg-[#222] border border-[#333] flex items-center justify-center shadow-lg mb-2">
            <User className="w-10 h-10 text-[#84cc16]" />
          </div>

          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {isLogin ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="text-sm text-[#888]">
              Passenger Portal
            </p>
          </div>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-xs font-medium text-[#666] uppercase tracking-wider">Full Name</Label>
              <Input
                id="fullName"
                placeholder="Your full name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
                className="bg-[#111] border-[#333] text-white placeholder:text-[#444] focus:border-[#84cc16] focus:ring-1 focus:ring-[#84cc16] h-12 rounded-xl transition-all"
                dir="auto"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-medium text-[#666] uppercase tracking-wider">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="bg-[#111] border-[#333] text-white placeholder:text-[#444] focus:border-[#84cc16] focus:ring-1 focus:ring-[#84cc16] h-12 rounded-xl transition-all"
            />
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs font-medium text-[#666] uppercase tracking-wider">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="055 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                className="bg-[#111] border-[#333] text-white placeholder:text-[#444] focus:border-[#84cc16] focus:ring-1 focus:ring-[#84cc16] h-12 rounded-xl transition-all"
                dir="ltr"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-medium text-[#666] uppercase tracking-wider">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              className="bg-[#111] border-[#333] text-white placeholder:text-[#444] focus:border-[#84cc16] focus:ring-1 focus:ring-[#84cc16] h-12 rounded-xl transition-all"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#84cc16] hover:bg-[#FCC419] text-black font-bold text-lg rounded-xl shadow-[0_4px_20px_rgba(245,216,72,0.2)] hover:shadow-[0_4px_25px_rgba(245,216,72,0.4)] transition-all duration-300"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              isLogin ? "Sign In" : "Sign Up"
            )}
          </Button>
        </form>

        {/* Footer Toggle */}
        <div className="text-center">
          <p className="text-[#666] text-sm">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#84cc16] font-semibold hover:underline transition-all"
            >
              {isLogin ? "Sign Up" : "Log In"}
            </button>
          </p>
        </div>

      </Card>

      {/* Footer Branding */}
      <div className="absolute bottom-6 text-[#333] text-xs font-mono">
        SECURE • ENCRYPTED • OFFICIAL
      </div>

    </div>
  );
};

export default CustomerAuth;
