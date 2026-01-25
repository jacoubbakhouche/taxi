import { useEffect, useState } from "react";
import { ShieldCheck, Car } from "lucide-react";

/**
 * Premium Splash Screen
 * Features a golden pulse animation and elegant typography.
 * Fits the dark/gold theme of Taxi DZ.
 */
export const SplashScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start exit animation after 2.5 seconds
    const timer = setTimeout(() => {
      setFading(true);
    }, 2500);

    // Unmount after animation completes (approx 3s total)
    const completionTimer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearTimeout(completionTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-700 ease-in-out ${fading ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
    >
      {/* Decorative Glow Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-900/20 via-black to-black animate-pulse" />

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo Container with Animation */}
        <div className="relative mb-6">
          {/* Outer Ring */}
          <div className="absolute -inset-4 rounded-full border border-yellow-500/30 animate-[spin_4s_linear_infinite]" />
          <div className="absolute -inset-8 rounded-full border border-dashed border-yellow-600/10 animate-[spin_10s_linear_infinite_reverse]" />

          {/* Main Icon Group */}
          <div className="relative w-24 h-24 bg-[#111] rounded-full flex items-center justify-center border border-yellow-500/20 shadow-2xl shadow-yellow-900/20 animate-bounce">
            <ShieldCheck className="w-12 h-12 text-yellow-500 absolute" />
            <Car className="w-6 h-6 text-white absolute bottom-5 right-5" />
          </div>
        </div>

        {/* Brand Name with Reveal Animation */}
        <h1 className="text-4xl font-black text-white tracking-widest uppercase mb-2 animate-in fade-in zoom-in duration-1000">
          Taxi <span className="text-yellow-500">DZ</span>
        </h1>

        {/* Subtitle / Tagline */}
        <p className="text-gray-500 text-xs tracking-[0.2em] animate-in slide-in-from-bottom-2 duration-1000 delay-300">
          PREMIUM TRANSPORT SECURITY
        </p>

        {/* Loading Indicator */}
        <div className="mt-8 w-32 h-1 bg-gray-900 rounded-full overflow-hidden">
          <div className="h-full bg-yellow-500 animate-[width_2s_ease-in-out_infinite]" style={{ width: '0%' }} />
        </div>
      </div>

      {/* Footer Version */}
      <div className="absolute bottom-10 text-gray-800 text-[10px] tracking-widest">
        v1.0.0
      </div>
    </div>
  );
};

export default SplashScreen;
