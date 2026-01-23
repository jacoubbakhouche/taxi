
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
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-end p-6 overflow-hidden relative font-sans">

      {/* Full Screen Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/cartoon_driver_splash.png?v=2"
          alt="Green Taxi City"
          className="w-full h-full object-cover animate-in fade-in duration-1000"
        />
        {/* Cinematic Gradient Overlay (Bottom to Top) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />
      </div>

      {/* Main Content (Overlaid) */}
      <div className="relative z-20 w-full max-w-md pb-8 space-y-6 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-300">

        <div className="space-y-2">
          <h2 className="text-[#84cc16] text-sm font-bold tracking-[0.2em] uppercase mb-1 drop-shadow-md">RAMEEGO DRIVER</h2>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight text-white drop-shadow-xl">
            Welcome to your <br />
            <span className="text-[#84cc16]">Green Journey</span> <br />
            start now
          </h1>
        </div>

        <SwipeButton
          onComplete={() => {
            // Navigate to Location Permission
            setTimeout(() => navigate("/location-permission"), 300);
          }}
          text="Swipe to Go"
        />

        <p className="text-center text-gray-400 text-xs mt-4 font-medium opacity-80">
          By continuing you agree to our Terms & Privacy Policy
        </p>
      </div>

    </div>
  );
};

export default Index;
