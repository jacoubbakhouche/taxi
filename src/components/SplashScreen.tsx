
import { useEffect, useState } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 500); // Wait for fade out animation
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-500 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="text-center animate-in fade-in zoom-in duration-1000 slide-in-from-bottom-5">
        <div className="w-24 h-24 mx-auto mb-4 bg-primary rounded-2xl rotate-12 flex items-center justify-center shadow-xl">
          <span className="text-4xl font-black text-primary-foreground transform -rotate-12">
            TAXI
          </span>
        </div>
        <h1 className="text-4xl font-bold tracking-tighter text-foreground">
          Taxi<span className="text-primary">DZ</span>
        </h1>
        <p className="text-muted-foreground mt-2 text-sm font-medium tracking-wide uppercase">
          Your Ride, Anywhere
        </p>
      </div>
    </div>
  );
};

export default SplashScreen;
