import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, User, Phone, Edit2, Save, X, Camera } from "lucide-react";
import { ProfileSkeleton } from "@/components/ProfileSkeleton";

interface UserProfile {
  id: string;
  full_name: string;
  phone: string;
  profile_image: string | null;
  rating: number;
  total_rides: number;
}

const CustomerProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editImage, setEditImage] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/customer/auth");
        return;
      }

      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", session.user.id)
        .single();

      if (error) throw error;

      setProfile(user);
      setEditName(user.full_name || "");
      setEditPhone(user.phone || "");
      setEditImage(user.profile_image || "");
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل تحميل البيانات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({
          full_name: editName,
          phone: editPhone,
          profile_image: editImage || null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile({
        ...profile,
        full_name: editName,
        phone: editPhone,
        profile_image: editImage || null,
      });
      setEditing(false);
      toast({
        title: "تم التحديث",
        description: "تم حفظ التعديلات بنجاح",
      });
    } catch (error: any) {
      console.error(error);
      toast({
        title: "خطأ",
        description: "فشل حفظ التعديلات",
        variant: "destructive",
      });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const filePath = `${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setEditImage(data.publicUrl);
      toast({ title: "تم رفع الصورة بنجاح" });
    } catch (error) {
      toast({ title: "فشل الرفع", description: "تأكد من صلاحيات الملف", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#111] flex items-center justify-center text-white">جاري التحميل...</div>;
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#111] text-white">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/customer/dashboard")}
          className="hover:bg-white/5 text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-lg font-bold">الملف الشخصي</h1>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      <div className="p-6 flex flex-col items-center">
        {/* Avatar Section */}
        <div className="relative mb-8">
          <Avatar className="w-32 h-32 border-4 border-[#84cc16]/50 shadow-2xl">
            <AvatarImage src={editing ? editImage : (profile.profile_image || "")} className="object-cover" />
            <AvatarFallback className="bg-[#1A1A1A] text-white">
              <User className="w-12 h-12 text-gray-400" />
            </AvatarFallback>
          </Avatar>

          {editing && (
            <label
              htmlFor="upload-avatar"
              className="absolute bottom-0 right-0 p-2 bg-[#84cc16] rounded-full cursor-pointer shadow-lg hover:bg-[#65a30d] transition-colors"
            >
              <Camera className="w-5 h-5 text-black" />
              <input id="upload-avatar" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
          )}
        </div>

        {/* Info or Edit Form */}
        <div className="w-full max-w-md space-y-6">
          {!editing ? (
            // VIEW MODE
            <div className="space-y-6 animate-in fade-in">
              <div className="text-center space-y-1 mb-8">
                <h2 className="text-3xl font-bold">{profile.full_name}</h2>
                <div className="flex items-center justify-center gap-2 text-gray-400">
                  <Phone className="w-4 h-4" />
                  <span className="text-lg" dir="ltr">{profile.phone}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1A1A1A] p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-3xl font-bold text-[#84cc16]">{profile.total_rides || 0}</p>
                  <p className="text-xs text-gray-500 uppercase mt-1">رحلة مكتملة</p>
                </div>
                <div className="bg-[#1A1A1A] p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-3xl font-bold text-yellow-500">{profile.rating?.toFixed(1) || "5.0"}</p>
                  <p className="text-xs text-gray-500 uppercase mt-1">التقييم العام</p>
                </div>
              </div>

              <Button
                className="w-full h-12 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl"
                onClick={() => setEditing(true)}
              >
                <Edit2 className="w-4 h-4 mr-2" /> تعديل الملف الشخصي
              </Button>
            </div>
          ) : (
            // EDIT MODE
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 bg-[#1A1A1A] p-6 rounded-2xl border border-white/10">
              <div className="space-y-2">
                <Label className="text-gray-400">الاسم الكامل</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-black/50 border-white/10 text-white h-12 text-center text-lg"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-400">رقم الهاتف</Label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="bg-black/50 border-white/10 text-white h-12 text-center text-lg"
                  dir="ltr"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <Button
                  variant="destructive"
                  className="flex-1 h-12 rounded-xl"
                  onClick={() => {
                    // Cancel logic
                    setEditing(false);
                    setEditName(profile.full_name);
                    setEditPhone(profile.phone);
                    setEditImage(profile.profile_image || "");
                  }}
                >
                  <X className="w-4 h-4 mr-2" /> إلغاء
                </Button>
                <Button
                  className="flex-[2] h-12 rounded-xl bg-[#84cc16] hover:bg-[#65a30d] text-black font-bold"
                  onClick={handleSaveProfile}
                >
                  <Save className="w-4 h-4 mr-2" /> حفظ التغييرات
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerProfile;
