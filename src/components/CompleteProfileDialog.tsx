import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface CompleteProfileDialogProps {
    open: boolean;
    userId: string;
    onComplete: () => void;
}

const CompleteProfileDialog = ({ open, userId, onComplete }: CompleteProfileDialogProps) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");

    // Prevent scrolling when open
    useEffect(() => {
        if (open) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "unset";
        return () => { document.body.style.overflow = "unset"; };
    }, [open]);

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

    const handleSubmit = async () => {
        if (!phone.trim()) {
            toast({ title: "تنبيه", description: "يرجى كتابة رقم الهاتف", variant: "destructive" });
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase
                .from('users')
                .update({ full_name: fullName, phone: phone })
                .eq('id', userId);

            if (error) throw error;

            toast({ title: "تم بنجاح", description: "أهلاً بك في Taxi DZ! 🎉" });
            onComplete();
        } catch (error: any) {
            console.error(error);
            toast({ title: "خطأ", description: "فشل حفظ البيانات", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-[#121212] flex flex-col font-sans" dir="rtl">

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
                            <h1 className="text-4xl font-black text-white mb-2 leading-tight">مرحباً بك في <br /> Taxi DZ!</h1>
                            <p className="text-gray-400 text-lg mb-8">دعنا نتعارف 👋</p>

                            <div className="space-y-2 mb-8">
                                <label className="text-gray-400 text-sm font-medium">الاسم الأول</label>
                                <Input
                                    autoFocus
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="مثال: محمد"
                                    className="bg-[#2A2A2A] border-none text-white text-xl h-14 rounded-xl px-4 placeholder:text-white/20 focus-visible:ring-2 focus-visible:ring-[#a3e635]"
                                />
                            </div>

                            <div className="mt-auto pb-8">
                                <Button
                                    className="w-full h-14 text-lg font-bold bg-[#a3e635] hover:bg-[#84cc16] text-black rounded-xl transition-transform active:scale-95"
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
                            <h1 className="text-3xl font-black text-white mb-8">رقم هاتفك 📱</h1>

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
                                        className="bg-[#2A2A2A] border-none text-white text-xl h-14 rounded-xl pl-24 pr-4 placeholder:text-white/20 focus-visible:ring-2 focus-visible:ring-[#a3e635] font-mono"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2 text-right">سنرسل رمز التحقق للتأكيد.</p>
                            </div>

                            <div className="mt-auto pb-8">
                                <Button
                                    className="w-full h-14 text-lg font-bold bg-[#a3e635] hover:bg-[#84cc16] text-black rounded-xl transition-transform active:scale-95"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : "حفظ ومتابعة"}
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>
        </div>
    );
};

export default CompleteProfileDialog;
