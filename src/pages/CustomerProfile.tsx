import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, User, Star, Phone, Edit2, Save, X, MapPin } from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string;
  phone: string;
  profile_image: string | null;
  rating: number;
  total_rides: number;
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
}

const CustomerProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editImage, setEditImage] = useState("");

  useEffect(() => {
    loadProfile();
    loadRides();
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
      setEditName(user.full_name);
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
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRides(data || []);
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
        })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile({
        ...profile,
        full_name: editName,
        profile_image: editImage || null,
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
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-secondary p-6 pb-20">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/customer/dashboard")}
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
            <AvatarImage src={profile.profile_image || undefined} />
            <AvatarFallback className="bg-white text-primary text-2xl">
              <User className="w-12 h-12" />
            </AvatarFallback>
          </Avatar>
          
          {editing ? (
            <div className="mt-4 space-y-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-center bg-white/20 border-white/30 text-white placeholder:text-white/60"
                placeholder="الاسم الكامل"
              />
              <Input
                value={editImage}
                onChange={(e) => setEditImage(e.target.value)}
                className="text-center bg-white/20 border-white/30 text-white placeholder:text-white/60"
                placeholder="رابط الصورة"
              />
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold mt-4">{profile.full_name}</h1>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Phone className="w-4 h-4" />
                <p className="text-white/90">{profile.phone}</p>
              </div>
            </>
          )}

          <div className="flex items-center justify-center gap-6 mt-4">
            <div>
              <p className="text-3xl font-bold">{profile.total_rides}</p>
              <p className="text-sm text-white/80">رحلة</p>
            </div>
            <div className="w-px h-12 bg-white/30"></div>
            <div>
              <div className="flex items-center gap-1 justify-center">
                <Star className="w-5 h-5 fill-white" />
                <p className="text-3xl font-bold">{profile.rating.toFixed(1)}</p>
              </div>
              <p className="text-sm text-white/80">التقييم</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 -mt-8">
        <Tabs defaultValue="completed" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-card shadow-lg">
            <TabsTrigger value="completed">الناجحة</TabsTrigger>
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

export default CustomerProfile;
