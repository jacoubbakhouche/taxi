import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, User, Star, Phone, Edit2, Save, X, MapPin, Car, DollarSign, Clock, Award } from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string;
  phone: string;
  profile_image: string | null;
  rating: number;
  total_rides: number;
  vehicle_type?: string;
  car_model?: string;
  license_plate?: string;
}

interface Ride {
  id: string;
  pickup_address: string;
  destination_address: string;
  price: number;
  status: string;
  rating: number | null;
  created_at: string;
  completed_at: string | null;
  distance: number;
  duration: number;
  customer_id: string;
}

const DriverProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editVehicleType, setEditVehicleType] = useState("");
  const [editCarModel, setEditCarModel] = useState("");
  const [editLicensePlate, setEditLicensePlate] = useState("");
  const [totalEarnings, setTotalEarnings] = useState(0);

  useEffect(() => {
    loadProfile();
    loadRides();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/driver/auth");
        return;
      }

      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", session.user.id)
        .single();

      if (error) throw error;

      setProfile(user);
      setEditName(user.full_name);
      setEditImage(user.profile_image || "");
      setEditVehicleType(user.vehicle_type || "");
      setEditCarModel(user.car_model || "");
      setEditLicensePlate(user.license_plate || "");
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

  const loadRides = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", session.user.id)
        .single();

      if (!user) return;

      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("driver_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRides(data || []);

      // Calculate total earnings from completed rides
      const earnings = (data || [])
        .filter(ride => ride.status === "completed")
        .reduce((sum, ride) => sum + (ride.price || 0), 0);
      setTotalEarnings(earnings);
    } catch (error: any) {
      console.error("Error loading rides:", error);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from("users")
        .update({
          full_name: editName,
          profile_image: editImage || null,
          vehicle_type: editVehicleType || null,
          car_model: editCarModel || null,
          license_plate: editLicensePlate || null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile({
        ...profile,
        full_name: editName,
        profile_image: editImage || null,
        vehicle_type: editVehicleType || null,
        car_model: editCarModel || null,
      });
      setEditing(false);
      toast({
        title: "تم التحديث",
        description: "تم حفظ التعديلات بنجاح",
      });
    } catch (error: any) {
      console.error("Save error details:", error);
      toast({
        title: "خطأ",
        description: `فشل حفظ التعديلات: ${error.message || "خطأ غير معروف"}`,
        variant: "destructive",
      });
    }
  };

  const getRidesByStatus = (status: string[]) => {
    return rides.filter((ride) => status.includes(ride.status));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ar-DZ", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const RideCard = ({ ride }: { ride: Ride }) => (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-primary mt-1" />
            <div>
              <p className="text-sm text-muted-foreground">من</p>
              <p className="font-medium">{ride.pickup_address}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-destructive mt-1" />
            <div>
              <p className="text-sm text-muted-foreground">إلى</p>
              <p className="font-medium">{ride.destination_address}</p>
            </div>
          </div>
        </div>
        <div className="text-left">
          <p className="text-xl font-bold text-primary">{ride.price} دج</p>
          <p className="text-xs text-muted-foreground">
            {ride.distance?.toFixed(1)} كم
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <p className="text-xs text-muted-foreground">{formatDate(ride.created_at)}</p>
        {ride.rating && (
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-lime-500 text-lime-500" />
            <span className="text-sm font-medium">{ride.rating}</span>
          </div>
        )}
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const completedRides = getRidesByStatus(["completed"]).length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      {/* Header */}
      <div className="bg-[#1A1A1A] pb-12 rounded-b-[3rem] shadow-2xl relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#84cc16] blur-[100px] rounded-full"></div>
          <div className="absolute top-1/2 -left-24 w-72 h-72 bg-blue-500 blur-[100px] rounded-full"></div>
        </div>

        <div className="p-6 relative z-10">
          <div className="flex items-center justify-between mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/driver/dashboard")}
              className="text-white hover:bg-white/10 rounded-full"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            {!editing ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditing(true)}
                className="text-white hover:bg-white/10 rounded-full"
              >
                <Edit2 className="w-5 h-5" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditing(false)}
                  className="text-white hover:bg-white/10 rounded-full"
                >
                  <X className="w-6 h-6" />
                </Button>
                <Button
                  size="icon"
                  onClick={handleSaveProfile}
                  className="bg-[#84cc16] hover:bg-[#84cc16]/90 text-black rounded-full shadow-[0_0_15px_rgba(132,204,22,0.5)]"
                >
                  <Save className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center">
            {/* Avatar Section */}
            <div className="relative mb-6 group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#84cc16] to-blue-500 rounded-full blur opacity-75 group-hover:opacity-100 transition-opacity"></div>
              <Avatar className="w-32 h-32 border-4 border-[#1A1A1A] relative shadow-2xl">
                <AvatarImage src={editImage || profile.profile_image || undefined} className="object-cover" />
                <AvatarFallback className="bg-[#2a2a2a] text-white text-4xl">
                  {profile.full_name?.[0]}
                </AvatarFallback>
              </Avatar>
              {editing && (
                <button
                  onClick={() => document.getElementById('driver-file-upload')?.click()}
                  className="absolute bottom-0 right-0 bg-[#84cc16] text-black p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              <input
                id="driver-file-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const fileExt = file.name.split('.').pop();
                    const filePath = `${Math.random()}.${fileExt}`;
                    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
                    if (uploadError) throw uploadError;
                    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                    setEditImage(data.publicUrl);
                    toast({ title: "تم رفع الصورة بنجاح" });
                  } catch (error) {
                    toast({ title: "failed to upload", variant: "destructive" });
                  }
                }}
              />
            </div>

            {/* Name & Stats */}
            {!editing ? (
              <div className="text-center space-y-2 animate-in slide-in-from-bottom-5 duration-500">
                <h1 className="text-3xl font-bold text-white tracking-tight">{profile.full_name}</h1>
                <div className="flex items-center justify-center gap-2 text-gray-400">
                  <Phone className="w-4 h-4" />
                  <span className="text-sm font-mono tracking-wider">{profile.phone}</span>
                </div>

                {/* Vehicle Badge */}
                {profile.vehicle_type && (
                  <div className="mt-4 inline-flex items-center gap-2 bg-[#2a2a2a] pl-4 pr-3 py-1.5 rounded-full border border-white/5">
                    <span className="text-xs text-gray-400 uppercase tracking-widest font-bold">DRIVER</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#84cc16]"></span>
                    <span className="text-[#84cc16] font-bold text-sm">
                      {profile.vehicle_type === 'taxi_owner' && 'مالك طاكسي'}
                      {profile.vehicle_type === 'taxi_rent' && 'سائق طاكسي'}
                      {profile.vehicle_type === 'vtc' && 'سائق خاص'}
                      {profile.vehicle_type === 'delivery' && 'توصيل'}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-center text-xl font-bold bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 w-3/4 rounded-xl backdrop-blur-sm"
                placeholder="الاسم الكامل"
                dir="rtl"
              />
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-6 -mt-8 relative z-20 space-y-6">

        {/* Stats Grid */}
        {!editing && (
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card p-4 rounded-2xl flex flex-col items-center justify-center text-center space-y-1 bg-[#1A1A1A]/80 backdrop-blur border border-white/5 shadow-xl">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-1">
                <Car className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-white">{completedRides}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Rides</p>
            </div>

            <div className="glass-card p-4 rounded-2xl flex flex-col items-center justify-center text-center space-y-1 bg-[#1A1A1A]/80 backdrop-blur border border-white/5 shadow-xl">
              <div className="w-10 h-10 rounded-full bg-[#84cc16]/10 flex items-center justify-center mb-1">
                <Star className="w-5 h-5 text-[#84cc16]" />
              </div>
              <p className="text-2xl font-bold text-white">{profile.rating.toFixed(1)}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Rating</p>
            </div>

            <div className="glass-card p-4 rounded-2xl flex flex-col items-center justify-center text-center space-y-1 bg-[#1A1A1A]/80 backdrop-blur border border-white/5 shadow-xl">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-1">
                <DollarSign className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-lg font-bold text-white whitespace-nowrap">{totalEarnings > 1000 ? (totalEarnings / 1000).toFixed(1) + 'k' : totalEarnings}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Earned</p>
            </div>
          </div>
        )}

        {/* Edit Form or Info View */}
        {editing ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-10 duration-500">
            {/* Vehicle Info Card */}
            <div className="bg-[#1A1A1A] p-5 rounded-3xl border border-white/5 shadow-xl space-y-4">
              <h3 className="text-[#84cc16] font-bold text-lg flex items-center gap-2 justify-end">
                <span>بيانات المركبة</span>
                <Car className="w-5 h-5" />
              </h3>

              <div className="space-y-1 text-right">
                <label className="text-xs text-gray-500 pr-1">طراز السيارة</label>
                <Input
                  value={editCarModel}
                  onChange={(e) => setEditCarModel(e.target.value)}
                  className="bg-[#252525] border-transparent text-white text-right h-12 rounded-xl focus:border-[#84cc16]/50 transition-colors"
                  placeholder="مثلاً: Symbol 2022"
                />
              </div>

              <div className="space-y-1 text-right">
                <label className="text-xs text-gray-500 pr-1">رقم اللوحة</label>
                <Input
                  value={editLicensePlate}
                  onChange={(e) => setEditLicensePlate(e.target.value)}
                  className="bg-[#252525] border-transparent text-white text-center font-mono h-12 rounded-xl focus:border-[#84cc16]/50"
                  placeholder="00000-116-16"
                />
              </div>
            </div>

            {/* Work Type Card */}
            <div className="bg-[#1A1A1A] p-5 rounded-3xl border border-white/5 shadow-xl space-y-4">
              <h3 className="text-[#84cc16] font-bold text-lg flex items-center gap-2 justify-end">
                <span>نوع العمل</span>
                <Award className="w-5 h-5" />
              </h3>

              <div className="grid grid-cols-2 gap-3" dir="rtl">
                {[
                  { id: 'taxi_owner', label: 'مالك طاكسي', icon: '🚕', desc: 'دفتر مقاعد + رخصة' },
                  { id: 'taxi_rent', label: 'سائق طاكسي', icon: '🔑', desc: 'يعمل عند الغير' },
                  { id: 'vtc', label: 'سائق خاص', icon: '🚙', desc: 'Yassir / Heetch' },
                ].map((type) => (
                  <div
                    key={type.id}
                    onClick={() => setEditVehicleType(type.id)}
                    className={`cursor-pointer rounded-2xl p-4 border transition-all duration-300 relative overflow-hidden group ${editVehicleType === type.id
                      ? 'bg-[#84cc16] border-[#84cc16] text-black shadow-[0_0_20px_rgba(132,204,22,0.3)]'
                      : 'bg-[#252525] border-transparent text-white hover:bg-[#333]'
                      }`}
                  >
                    <div className="relative z-10 flex flex-col items-center text-center">
                      <span className="text-3xl mb-2">{type.icon}</span>
                      <span className="font-bold text-sm">{type.label}</span>
                      <span className={`text-[10px] mt-1 ${editVehicleType === type.id ? 'text-black/70' : 'text-gray-500'}`}>
                        {type.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* View Mode Info Cards */
          <div className="space-y-4">
            <div className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5 flex items-center justify-between shadow-lg">
              <div className="text-right">
                <p className="text-gray-500 text-xs uppercase font-bold tracking-wider mb-1">Vehicule</p>
                <p className="text-white font-bold text-lg">{profile.car_model || "-------"}</p>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded font-mono text-gray-300">{profile.license_plate || "---"}</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-full bg-[#252525] flex items-center justify-center border border-white/10 shadow-inner">
                <Car className="w-6 h-6 text-gray-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 -mt-8">
        <Tabs defaultValue="completed" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-card shadow-lg">
            <TabsTrigger value="completed">المكتملة</TabsTrigger>
            <TabsTrigger value="cancelled">الملغاة</TabsTrigger>
            <TabsTrigger value="rejected">المرفوضة</TabsTrigger>
          </TabsList>

          <TabsContent value="completed" className="space-y-3 mt-4">
            {getRidesByStatus(["completed"]).length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">لا توجد رحلات مكتملة</p>
              </Card>
            ) : (
              getRidesByStatus(["completed"]).map((ride) => (
                <RideCard key={ride.id} ride={ride} />
              ))
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-3 mt-4">
            {getRidesByStatus(["cancelled"]).length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">لا توجد رحلات ملغاة</p>
              </Card>
            ) : (
              getRidesByStatus(["cancelled"]).map((ride) => (
                <RideCard key={ride.id} ride={ride} />
              ))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-3 mt-4">
            {getRidesByStatus(["rejected"]).length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">لا توجد رحلات مرفوضة</p>
              </Card>
            ) : (
              getRidesByStatus(["rejected"]).map((ride) => (
                <RideCard key={ride.id} ride={ride} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div >
    </div >
  );
};

export default DriverProfile;
