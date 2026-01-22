import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, User, Star, Phone, Edit2, Save, X, MapPin, Car, DollarSign, Clock } from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string;
  phone: string;
  profile_image: string | null;
  rating: number;
  total_rides: number;
  vehicle_type?: string;
  car_model?: string;
  vehicle_color?: string;
  vehicle_class?: string;
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
  const [editVehicleColor, setEditVehicleColor] = useState("");
  const [editVehicleClass, setEditVehicleClass] = useState("standard");
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
      setEditVehicleColor(user.vehicle_color || "");
      setEditVehicleClass(user.vehicle_class || "standard");
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
          vehicle_color: editVehicleColor || null,
          vehicle_class: editVehicleClass || 'standard',
        })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile({
        ...profile,
        full_name: editName,
        profile_image: editImage || null,
        vehicle_type: editVehicleType || null,
        car_model: editCarModel || null,
        vehicle_color: editVehicleColor || null,
        vehicle_class: editVehicleClass || 'standard',
      });
      setEditing(false);
      toast({
        title: "تم التحديث",
        description: "تم حفظ التعديلات بنجاح",
      });
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: "فشل حفظ التعديلات",
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
      <div className="bg-gradient-to-b from-[#84cc16] via-[#84cc16]/80 to-[#1A1A1A] p-6 pb-20 border-b border-white/5">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/driver/dashboard")}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          {!editing ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditing(true)}
              className="text-white hover:bg-white/20"
            >
              <Edit2 className="w-5 h-5" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditing(false)}
                className="text-white hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSaveProfile}
                className="text-white hover:bg-white/20"
              >
                <Save className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>

        <div className="text-center text-white">
          <Avatar className="w-24 h-24 mx-auto border-4 border-white shadow-lg">
            <AvatarImage src={editImage || profile.profile_image || undefined} className="object-cover" />
            <AvatarFallback className="bg-white text-primary text-2xl">
              <Car className="w-12 h-12" />
            </AvatarFallback>
          </Avatar>


          {editing ? (
            <div className="mt-4 space-y-4 w-full max-w-md mx-auto">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-center bg-white/20 border-white/30 text-white placeholder:text-white/60"
                placeholder="الاسم الكامل"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={editCarModel}
                  onChange={(e) => setEditCarModel(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                  placeholder="طراز السيارة (مثلاً Toyota)"
                />
                <Input
                  value={editVehicleColor}
                  onChange={(e) => setEditVehicleColor(e.target.value)}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                  placeholder="لون السيارة"
                />
              </div>

              {/* Vehicle Class Selector with 3D Images */}
              <div className="space-y-4 text-right">
                <label className="text-white text-sm font-bold block px-1">اختر مركبتك (3D)</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'economy', label: 'اقتصادية', img: '/cars/economy.png' },
                    { id: 'standard', label: 'عادية', img: '/cars/standard.png' },
                    { id: 'taxi', label: 'طاكسي', img: '/cars/taxi.png' },
                    { id: 'luxury', label: 'فاخرة', img: '/cars/luxury.png' },
                    { id: 'suv', label: 'عائلية', img: '/cars/suv.png' },
                  ].map((cls) => (
                    <div
                      key={cls.id}
                      onClick={() => setEditVehicleClass(cls.id)}
                      className={`relative overflow-hidden cursor-pointer rounded-xl border-2 transition-all duration-300 ${editVehicleClass === cls.id
                          ? 'bg-[#84cc16]/20 border-[#84cc16] shadow-[0_0_20px_rgba(245,216,72,0.3)]'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                    >
                      <div className="p-2 z-10 relative">
                        <span className={`text-xs font-bold ${editVehicleClass === cls.id ? 'text-[#84cc16]' : 'text-white'}`}>
                          {cls.label}
                        </span>
                      </div>
                      <div className="w-full h-24 flex items-center justify-center p-2">
                        <img
                          src={cls.img}
                          alt={cls.label}
                          className="w-full h-full object-contain drop-shadow-xl transform hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 text-right">
                <label className="text-white text-sm font-bold block mb-2 px-1">نوع العمل</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'taxi_owner', label: 'مالك طاكسي', icon: '🚕', desc: 'سيارة صفراء (رخصة)' },
                    { id: 'taxi_rent', label: 'يعمل عند طاكسي', icon: '🔑', desc: 'سائق باليومية' },
                    { id: 'vtc', label: 'سيارة سياحية', icon: '🚙', desc: 'نقل عبر التطبيقات' },
                    { id: 'delivery', label: 'توصيل طلبات', icon: '📦', desc: 'دراجة أو سيارة' },
                  ].map((type) => (
                    <div
                      key={type.id}
                      onClick={() => setEditVehicleType(type.id)}
                      className={`cursor-pointer rounded-xl p-3 border-2 transition-all ${editVehicleType === type.id
                        ? 'bg-[#84cc16] border-[#84cc16] text-black'
                        : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                        }`}
                    >
                      <div className="text-2xl mb-1">{type.icon}</div>
                      <div className="font-bold text-sm">{type.label}</div>
                      <div className={`text-[10px] ${editVehicleType === type.id ? 'text-black/70' : 'text-gray-400'}`}>
                        {type.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
                  onClick={() => document.getElementById('driver-file-upload')?.click()}
                  disabled={loading}
                >
                  تغيير الصورة
                </Button>
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
                      toast({ title: "failed to upload", variant: "destructive" });
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Profile View Mode */}

              {/* 3D Car & Avatar Combo */}
              <div className="relative mt-8 mb-6 h-32 flex items-end justify-center">
                {/* Car Image (Largest) */}
                {profile.vehicle_class && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 z-10 animate-in fade-in zoom-in duration-700">
                    <img
                      src={`/cars/${profile.vehicle_class}.png`}
                      onError={(e) => e.currentTarget.src = '/cars/standard.png'}
                      alt="Vehicle"
                      className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                    />
                  </div>
                )}

                {/* Avatar (Floating Badge) */}
                <div className="absolute -bottom-4 right-1/2 translate-x-16 z-20">
                  <Avatar className="w-16 h-16 border-4 border-[#1A1A1A] shadow-xl">
                    <AvatarImage src={profile.profile_image || undefined} className="object-cover" />
                    <AvatarFallback className="bg-white text-black font-bold">
                      {profile.full_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>

              <h1 className="text-2xl font-bold mt-6 text-white text-center drop-shadow-md">{profile.full_name}</h1>

              <div className="flex items-center justify-center gap-2 mt-2">
                {/* Display Vehicle Badge if exists */}
                {profile.vehicle_type && (
                  <span className="bg-[#84cc16] text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg shadow-lime-500/20">
                    {profile.vehicle_type === 'taxi_owner' && '🚕 مالك طاكسي'}
                    {profile.vehicle_type === 'taxi_rent' && '🔑 سائق طاكسي'}
                    {profile.vehicle_type === 'vtc' && '🚙 سائق خاص'}
                    {profile.vehicle_type === 'delivery' && '📦 توصيل'}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Phone className="w-4 h-4" />
                <p className="text-white/90">{profile.phone}</p>
              </div>
            </>
          )}

          <div className="flex items-center justify-center gap-4 mt-4">
            <div>
              <p className="text-2xl font-bold">{completedRides}</p>
              <p className="text-xs text-white/80">رحلة مكتملة</p>
            </div>
            <div className="w-px h-12 bg-white/30"></div>
            <div>
              <div className="flex items-center gap-1 justify-center">
                <Star className="w-4 h-4 fill-white" />
                <p className="text-2xl font-bold">{profile.rating.toFixed(1)}</p>
              </div>
              <p className="text-xs text-white/80">التقييم</p>
            </div>
            <div className="w-px h-12 bg-white/30"></div>
            <div>
              <p className="text-2xl font-bold">{totalEarnings.toLocaleString()}</p>
              <p className="text-xs text-white/80">دج الأرباح</p>
            </div>
          </div>
        </div>
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
      </div>
    </div>
  );
};

export default DriverProfile;
