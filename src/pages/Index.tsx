
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col items-center justify-between p-6 pb-10 font-sans" dir="rtl">

      {/* Top Section: Image & Text */}
      <div className="flex-1 flex flex-col items-center justify-center w-full space-y-8 mt-10">

        {/* Hero Image - Centered and Contained */}
        <div className="relative w-full max-w-[320px] aspect-square flex items-center justify-center">
          <div className="absolute inset-0 bg-[#84cc16]/10 rounded-full blur-[80px] pointer-events-none"></div>
          <img
            src="/images/driver_welcome_hero.png"
            alt="Welcome"
            className="w-full h-full object-contain relative z-10 drop-shadow-2xl animate-in fade-in zoom-in duration-700"
          />
        </div>

        {/* Text Content */}
        <div className="text-center space-y-4 max-w-sm mx-auto animate-in slide-in-from-bottom-5 fade-in duration-700 delay-200">
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-normal">
            التطبيق الأمثل لك <br />
            <span className="text-[#84cc16]">للعروض العادلة</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed px-4">
            يمكنك اختيار الرحلات المناسبة لك بحرية تامة وبدون عمولات خفية.
          </p>
        </div>
      </div>

      {/* Bottom Section: Button & Policy */}
      <div className="w-full max-w-md space-y-6 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-500">

        {/* Pagination Indicators (Visual match) */}
        <div className="flex justify-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-white transition-all"></div>
          <div className="w-2 h-2 rounded-full bg-white/20 hover:bg-white/40 transition-all cursor-pointer"></div>
        </div>

        <Button
          onClick={() => navigate("/location-permission")}
          className="w-full h-14 bg-[#84cc16] hover:bg-[#72b313] text-black font-bold text-xl rounded-xl shadow-[0_0_25px_rgba(132,204,22,0.4)] transition-all hover:scale-[1.02] active:scale-95"
        >
          متابعة
        </Button>

        <p className="text-center text-gray-500 text-xs">
          بالنقر على متابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية
        </p>
      </div>

    </div>
  );
};

export default Index;
