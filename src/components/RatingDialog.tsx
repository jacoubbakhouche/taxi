import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (rating: number) => void;
  driverName: string;
}

const RatingDialog = ({ open, onOpenChange, onSubmit, driverName }: RatingDialogProps) => {
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);

  const handleSubmit = () => {
    onSubmit(rating);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">🎉 تمت الرحلة بنجاح!</DialogTitle>
          <DialogDescription className="text-center">
            كيف كانت تجربتك مع السائق {driverName}؟
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 ${
                    star <= (hoveredRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="text-center">
            <p className="text-2xl font-bold text-primary">
              {rating === 5 && "ممتاز! 🌟"}
              {rating === 4 && "جيد جداً! 👍"}
              {rating === 3 && "جيد 😊"}
              {rating === 2 && "مقبول 🙂"}
              {rating === 1 && "يحتاج تحسين 😕"}
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full bg-gradient-to-r from-primary to-secondary"
          >
            إرسال التقييم
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RatingDialog;
