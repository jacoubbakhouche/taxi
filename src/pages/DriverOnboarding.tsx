import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";

// You can replace these URLs with your actual image paths in the public folder
// e.g., "/images/onboarding-1.png"
const STEPS = [
    {
        id: 1,
        title: "سائقون متحقق منهم",
        description: "يخضع جميع السائقين للتحقق عند تسجيلهم في التطبيق. إننا نتحقق من رخصة قيادتهم وبطاقة هويتهم وأية مستندات أخرى مطلوبة.",
        image: "/images/onboarding_driver_1.png", // Replace with your uploaded image 1
        bgColor: "bg-[#84cc16]", // Lime green matching the design
    },
    {
        id: 2,
        title: "صور الملف التعريفي",
        description: "لسهولة التعرف وحماية الركاب، يستخدم السائقون صورة حقيقية للملف التعريفي - وهي صور شخصية حقيقية تم التقاطها أثناء التحقق.",
        image: "/images/onboarding_driver_2.png", // Replace with your uploaded image 2
        bgColor: "bg-[#84cc16]",
    }
];

const DriverOnboarding = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            navigate("/driver/auth");
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        } else {
            navigate("/role-selection");
        }
    };

    const step = STEPS[currentStep];

    return (
        <div className="min-h-screen bg-[#121212] text-white flex flex-col relative overflow-hidden font-sans" dir="rtl">

            {/* Top Navigation */}
            <div className="flex justify-between items-center p-6 z-10">
                <button onClick={handleBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition">
                    <ChevronRight className="w-6 h-6 text-white" />
                </button>

                {/* Progress Indicators */}
                <div className="flex gap-2">
                    {STEPS.map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-8 bg-[#84cc16]' : 'w-2 bg-gray-700'}`}
                        />
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 text-center z-10 animate-in fade-in slide-in-from-bottom-4 duration-500 key={currentStep}">

                {/* Image Container */}
                <div className="relative mb-12 w-full max-w-xs aspect-square flex items-center justify-center">
                    {/* Abstract Shapes Background similar to your design */}
                    <div className="absolute inset-0 bg-[#84cc16] opacity-10 blur-[100px] rounded-full transform scale-150"></div>

                    {/* 
                 PLACEHOLDER FOR YOUR IMAGES 
                 I'm using a styled div to represent the vector art style if image is missing.
                 Once you put your images in public/images/..., the img tag will work.
             */}
                    <div className="relative w-64 h-64">
                        <img
                            src={step.image}
                            alt={step.title}
                            className="w-full h-full object-contain drop-shadow-2xl"
                            onError={(e) => {
                                // Fallback if image not found to show SOMETHING cool
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML = `<div class="w-full h-full bg-[#84cc16] rounded-3xl rotate-3 flex items-center justify-center text-black font-bold text-6xl shadow-2xl skew-y-3 border-4 border-black"><span class="rotate-[-3deg] skew-y-[-3deg]">${currentStep + 1}</span></div>`;
                            }}
                        />
                    </div>
                </div>

                <h1 className="text-3xl font-bold mb-4 leading-tight">
                    {step.title}
                </h1>

                <p className="text-gray-400 text-lg leading-relaxed max-w-sm">
                    {step.description}
                </p>

            </div>

            {/* Bottom Action Area */}
            <div className="p-8 z-10">
                <Button
                    onClick={handleNext}
                    className="w-full h-14 text-lg font-bold bg-[#84cc16] hover:bg-[#65a30d] text-black rounded-xl shadow-[0_0_20px_rgba(132,204,22,0.3)] transition-all hover:scale-[1.02] active:scale-95"
                >
                    {currentStep === STEPS.length - 1 ? "ابدأ الآن" : "التالي"}
                </Button>
            </div>

        </div>
    );
};

export default DriverOnboarding;
