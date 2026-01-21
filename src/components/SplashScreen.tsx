
import { useEffect, useState } from "react";
import Map from "./Map";
import { Loader2 } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);
  // Default center (Annaba/Algiers)
  const defaultCenter: [number, number] = [36.9009, 7.7669];

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500); // Wait for fade out animation
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 transition-opacity duration-500 ${isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
    >
      {/* Map Background */}
      <div className="absolute inset-0 z-0 opacity-50">
        <Map center={defaultCenter} zoom={14} />
      </div>

      {/* Overlay Content */}
      <div className="relative z-10 text-center animate-in fade-in zoom-in duration-1000 slide-in-from-bottom-5 p-8 rounded-2xl bg-black/40 backdrop-blur-sm border border-white/10">
        <div className="w-20 h-20 mx-auto mb-6 bg-[#F5D848] rounded-2xl rotate-12 flex items-center justify-center shadow-[0_0_30px_rgba(245,216,72,0.6)]">
          <span className="text-3xl font-black text-black transform -rotate-12">
            TAXI
          </span>
        </div>
        <h1 className="text-4xl font-bold tracking-tighter text-white drop-shadow-lg mb-2">
          Taxi<span className="text-[#F5D848]">DZ</span>
        </h1>

        <div className="flex items-center justify-center gap-2 mt-6">
          <Loader2 className="w-5 h-5 text-[#F5D848] animate-spin" />
          <span className="text-white/80 text-sm font-medium tracking-widest uppercase">
            Connecting...
          </span>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
