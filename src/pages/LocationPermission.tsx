import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const LocationPermission = () => {
    const navigate = useNavigate();

    const handleEnableLocation = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log("Location access granted:", position);
                    // Proceed to role selection or previous intent
                    navigate("/role-selection");
                },
                (error) => {
                    console.error("Location access denied:", error);
                    // Still proceed but maybe show a toast (or just go to valid screen)
                    navigate("/role-selection");
                }
            );
        } else {
            navigate("/role-selection");
        }
    };



    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-end p-6 pb-12 overflow-hidden relative font-sans" dir="rtl">

            {/* Full Screen Background Image */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/images/map_illustration.png"
                    alt="Location Permission Map"
                    className="w-full h-full object-cover animate-in fade-in duration-1000"
                />
                {/* Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />
            </div>

            {/* Content Section (Overlaid at bottom) */}
            <div className="relative z-20 w-full max-w-md space-y-6 animate-in slide-in-from-bottom-10 fade-in duration-700 delay-200">

                <div className="text-center space-y-4">
                    <div className="inline-block p-4 rounded-full bg-[#84cc16]/10 mb-2 border border-[#84cc16]/20 backdrop-blur-md">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#84cc16"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                    </div>

                    <h1 className="text-3xl font-bold text-white drop-shadow-xl">
                        السماح بالوصول <br /> <span className="text-[#84cc16]">لموقعك الحالي</span>
                    </h1>

                    <p className="text-gray-300 text-sm leading-relaxed px-4 opacity-90">
                        لضمان وصول الكابتن إليك بسرعة ودقةق.
                    </p>
                </div>

                <Button
                    onClick={handleEnableLocation}
                    className="w-full bg-[#84cc16] hover:bg-[#65a30d] text-black font-bold h-14 text-lg rounded-2xl shadow-[0_0_20px_rgba(132,204,22,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    تمكين خدمات الموقع
                </Button>
            </div>
        </div>
    );
};

export default LocationPermission;
