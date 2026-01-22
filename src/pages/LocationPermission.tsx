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

    const handleSkip = () => {
        navigate("/role-selection");
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-between p-6 pb-12" dir="rtl">
            <div className="flex-1 flex flex-col items-center justify-center w-full">
                {/* Illustration */}
                <div className="w-full max-w-sm aspect-square relative mb-8 flex items-center justify-center">
                    {/* Using the generated green/black illustration */}
                    <img
                        src="/images/location_permission.png"
                        alt="Location Permission"
                        className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(132,204,22,0.2)]"
                    />
                </div>

                {/* Text Content */}
                <div className="text-center space-y-4 max-w-xs">
                    <h1 className="text-2xl font-bold text-white">
                        السماح للتطبيق بالوصول إلى موقعك
                    </h1>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        هذا ضروري لكي يتمكن الكابتن الأقرب من تلقي طلب الركوب وتوفير أفضل تجربة لك.
                    </p>
                </div>
            </div>

            {/* Buttons */}
            <div className="w-full max-w-md space-y-3">
                <Button
                    onClick={handleEnableLocation}
                    className="w-full bg-[#84cc16] hover:bg-[#65a30d] text-black font-bold h-12 text-lg rounded-xl shadow-[0_0_15px_rgba(132,204,22,0.4)] transition-all"
                >
                    تمكين خدمات الموقع
                </Button>

                <Button
                    variant="ghost"
                    onClick={handleSkip}
                    className="w-full text-gray-500 hover:text-white hover:bg-white/5 h-12 rounded-xl"
                >
                    تخطي
                </Button>
            </div>
        </div>
    );
};

export default LocationPermission;
