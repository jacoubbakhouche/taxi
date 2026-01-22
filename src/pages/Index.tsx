
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SplashScreen from "@/components/SplashScreen";
import SwipeButton from "@/components/SwipeButton";

const Index = () => {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#111111] text-white flex flex-col items-center justify-between p-6 overflow-hidden relative font-sans">

      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#84cc16]/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 -z-0 pointer-events-none" />

      {/* Top Section: Header/Logo (Simulated App Bar) */}
      <div className="w-full pt-4 z-10 flex justify-between items-center opacity-80">
        {/* Placeholder for status bar or simple branding */}
        <div className="text-xs font-mono text-[#666]">TAXI DZ • STARTED</div>
      </div>

      {/* Main Visual Section */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg z-10 -mt-10">

        {/* Comic Style Taxi */}
        <div className="relative w-full mb-8">
          <div className="absolute inset-0 bg-lime-500/10 blur-2xl transform scale-90 translate-y-4 rounded-full" />
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/5">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-20 pointer-events-none" />
            <img
              src="/taxi-sketch.png"
              alt="Taxi Sketch"
              className="w-full h-auto object-cover relative z-10 animate-in fade-in zoom-in duration-700 ease-out mask-image:linear-gradient(to bottom, black 80%, transparent 100%)"
            />
          </div>
        </div>

        {/* Text Content */}
        <div className="w-full text-left space-y-4 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-300">
          <div className="space-y-1">
            <h2 className="text-[#84cc16] text-sm font-bold tracking-widest uppercase mb-2">RAMEEGO FOR DRIVERS</h2>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white">
              Welcome to your <br />
              journey to success <br />
              starts now
            </h1>
          </div>
        </div>

      </div>

      {/* Bottom Action Section */}
      <div className="w-full max-w-md pb-8 z-10 animate-in slide-in-from-bottom-5 fade-in duration-700 delay-500">
        <SwipeButton
          onComplete={() => {
            // Add a small delay for the animation to finish
            setTimeout(() => navigate("/location-permission"), 300);
          }}
          text="Swipe to Go"
        />

        <p className="text-center text-[#444] text-xs mt-6 font-medium">
          By continuing you agree to our Terms & Privacy Policy
        </p>
      </div>

    </div>
  );
};

export default Index;
