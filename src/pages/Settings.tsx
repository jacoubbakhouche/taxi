
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, LogOut, Trash2, Settings as SettingsIcon, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const Settings = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    const handleDeleteAccount = async () => {
        setLoading(true);
        try {
            // 1. First, try to call the secure RPC if it exists
            const { error: rpcError } = await supabase.rpc('delete_own_account');

            if (rpcError) {
                // Fallback: Try to delete from public.users directly if RPC is missing
                // This only works if RLS allows it and no auth foreign key blocks it (rarely works for Auth)
                console.warn("RPC failed, trying direct delete...", rpcError);

                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const { error: deleteError } = await supabase
                        .from('users')
                        .delete()
                        .eq('id', session.user.id);

                    if (deleteError) throw deleteError;

                    // If successful, sign out
                    await supabase.auth.signOut();
                }
            } else {
                // RPC Success - User is deleted from Auth, so session is invalid.
                await supabase.auth.signOut();
            }

            toast({
                title: "تم حذف الحساب",
                description: "تم حذف جميع بياناتك بنجاح.",
            });
            navigate("/");

        } catch (error: any) {
            console.error("Delete account error:", error);
            toast({
                title: "خطأ",
                description: "فشل حذف الحساب. يرجى التواصل مع الدعم إذا استمرت المشكلة.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
        // Put direction on the body/html if needed, or just rely on the parent div's dir attribute for this page
        document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
    };

    return (
        <div className="min-h-screen bg-[#111111] font-sans pb-10" dir={isRTL ? "rtl" : "ltr"}>
            {/* Header */}
            <div className="bg-[#1A1A1A] p-6 shadow-xl rounded-b-[2rem] border-b border-white/5 mb-8">
                <div className="flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(-1)}
                        className="text-white hover:bg-white/10 rounded-full"
                    >
                        <ArrowLeft className={`w-6 h-6 ${isRTL ? "" : "rotate-180"}`} />
                    </Button>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        {t('settings.title')} <SettingsIcon className="w-6 h-6 text-[#84cc16]" />
                    </h1>
                </div>
            </div>

            <div className="px-6 space-y-6 max-w-md mx-auto">

                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-sm text-gray-400 leading-relaxed">
                    {t('settings.warning')}
                </div>

                {/* Language Selection */}
                <Card className="bg-[#1A1A1A] border-white/5 p-4 rounded-xl space-y-4">
                    <div className="flex items-center gap-2 text-white mb-2">
                        <Globe className="w-5 h-5 text-[#84cc16]" />
                        <span className="font-bold">{t('settings.language')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant={i18n.language === 'en' ? "default" : "outline"}
                            className={`h-12 border-white/10 ${i18n.language === 'en' ? "bg-[#84cc16] text-black hover:bg-[#72b013]" : "bg-transparent text-white hover:bg-white/5"}`}
                            onClick={() => changeLanguage('en')}
                        >
                            English
                        </Button>
                        <Button
                            variant={i18n.language === 'ar' ? "default" : "outline"}
                            className={`h-12 border-white/10 ${i18n.language === 'ar' ? "bg-[#84cc16] text-black hover:bg-[#72b013]" : "bg-transparent text-white hover:bg-white/5"}`}
                            onClick={() => changeLanguage('ar')}
                        >
                            العربية
                        </Button>
                    </div>
                </Card>

                <div className="space-y-4">
                    <Button
                        variant="ghost"
                        className="w-full justify-between h-16 bg-[#1A1A1A] hover:bg-[#252525] text-white rounded-xl border border-white/5 px-6 group"
                        onClick={handleLogout}
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-gray-800 p-2 rounded-lg group-hover:bg-gray-700 transition-colors">
                                <LogOut className="w-5 h-5 text-gray-400" />
                            </div>
                            <span className="font-bold text-lg">{t('common.logout')}</span>
                        </div>
                    </Button>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                className="w-full justify-between h-16 bg-[#1A1A1A] hover:bg-red-500/10 text-red-500 hover:text-red-400 rounded-xl border border-white/5 px-6 group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="bg-red-500/10 p-2 rounded-lg group-hover:bg-red-500/20 transition-colors">
                                        <Trash2 className="w-5 h-5" />
                                    </div>
                                    <span className="font-bold text-lg">{t('settings.deleteAccount')}</span>
                                </div>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-[#1A1A1A] border border-white/10 text-white">
                            <AlertDialogHeader>
                                <AlertDialogTitle className={`text-red-500 ${isRTL ? "text-right" : "text-left"}`}>
                                    {t('settings.confirmDeleteTitle')}
                                </AlertDialogTitle>
                                <AlertDialogDescription className={`text-gray-400 ${isRTL ? "text-right" : "text-left"}`}>
                                    {t('settings.confirmDeleteDesc')}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className={`flex gap-2 ${isRTL ? "flex-row-reverse" : "flex-row"}`}>
                                <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5">
                                    {t('common.cancel')}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteAccount}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    disabled={loading}
                                >
                                    {loading ? t('settings.deleting') : t('settings.deleteAction')}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>

            </div>
        </div>
    );
};

export default Settings;
