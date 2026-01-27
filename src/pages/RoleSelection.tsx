
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, User, ArrowRight, ChevronLeft } from "lucide-react";

const RoleSelection = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#111111] text-white flex flex-col p-6 relative overflow-hidden font-sans">

      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-[#84cc16]/5 rounded-full blur-[80px] -translate-x-1/2 -transition-y-1/2 pointer-events-none" />

      {/* Header / Nav */}
      <div className="w-full z-10 flex items-center mb-8 pt-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="text-white hover:bg-white/10 rounded-full"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full space-y-8">

        {/* Title Section */}
        <div className="space-y-2 animate-in slide-in-from-left-4 fade-in duration-500">
          <h2 className="text-[#84cc16] text-sm font-bold tracking-widest uppercase">
            CHOOSE YOUR PATH
          </h2>
          <h1 className="text-4xl font-bold leading-tight">
            Who are you?
          </h1>
          <p className="text-[#888] text-lg">
            Select your role to begin your journey.
          </p>
        </div>

        {/* Selection Cards */}
        <div className="grid gap-6">

          {/* Passenger Card */}
          <Card
            className="group relative overflow-hidden bg-[#1A1A1A] border border-[#333] hover:border-[#84cc16] transition-all duration-300 cursor-pointer p-6 animate-in slide-in-from-bottom-4 fade-in duration-500 delay-100"
            onClick={() => navigate("/customer/auth")}
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-xl bg-[#222] flex items-center justify-center group-hover:bg-[#84cc16] transition-colors duration-300">
                <User className="w-7 h-7 text-[#DDD] group-hover:text-black transition-colors" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-[#84cc16] transition-colors">Passenger</h3>
                <p className="text-sm text-[#666] group-hover:text-[#999] transition-colors">
                  Looking for a ride
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-[#444] group-hover:text-[#84cc16] group-hover:translate-x-1 transition-all" />
            </div>
          </Card>

          {/* Driver Card */}
          <Card
            className="group relative overflow-hidden bg-[#1A1A1A] border border-[#333] hover:border-[#84cc16] transition-all duration-300 cursor-pointer p-6 animate-in slide-in-from-bottom-4 fade-in duration-500 delay-200"
            onClick={() => navigate("/driver/onboarding")}
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-xl bg-[#222] flex items-center justify-center group-hover:bg-[#84cc16] transition-colors duration-300">
                <Car className="w-7 h-7 text-[#DDD] group-hover:text-black transition-colors" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-[#84cc16] transition-colors">Driver</h3>
                <p className="text-sm text-[#666] group-hover:text-[#999] transition-colors">
                  I want to accept rides
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-[#444] group-hover:text-[#84cc16] group-hover:translate-x-1 transition-all" />
            </div>
          </Card>



        </div>
      </div>

      <div className="h-10" /> {/* Spacer */}
    </div>
  );
};

export default RoleSelection;
