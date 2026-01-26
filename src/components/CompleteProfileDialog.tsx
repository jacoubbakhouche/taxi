import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CompleteProfileDialogProps {
    open: boolean;
    userId: string;
    onComplete: () => void;
}

const CompleteProfileDialog = ({ open, userId, onComplete }: CompleteProfileDialogProps) => {
    const [loading, setLoading] = useState(false);
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim() || !phone.trim()) {
            toast({ title: "خطأ", description: "يرجى ملء جميع الحقول", variant: "destructive" });
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase
                .from('users')
                .update({ full_name: fullName, phone: phone })
                .eq('id', userId);

            if (error) throw error;

            toast({ title: "تم التحديث", description: "تم تحديث الملف الشخصي بنجاح" });
            onComplete();
        } catch (error: any) {
            console.error(error);
            toast({ title: "خطأ", description: "فشل تحديث المعلومات", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent className="bg-[#1A1A1A] border border-white/10 text-white sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center">إكمال الملف الشخصي 📝</DialogTitle>
                    <DialogDescription className="text-center text-gray-400">
                        يرجى إدخال اسمك ورقم هاتفك للمتابعة. هذه المعلومات ضرورية للتواصل مع السائق.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-white">الاسم الكامل</Label>
                        <Input
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="مثال: محمد أحمد"
                            className="bg-white/5 border-white/10 text-white text-right"
                            dir="rtl"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone" className="text-white">رقم الهاتف</Label>
                        <Input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="05 XX XX XX XX"
                            className="bg-white/5 border-white/10 text-white text-right"
                            dir="ltr"
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full bg-[#84cc16] hover:bg-[#65a30d] text-black font-bold h-12 text-lg"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="animate-spin" /> : "حفظ ومتابعة"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default CompleteProfileDialog;
