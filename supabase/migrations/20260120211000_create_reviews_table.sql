-- Create reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public reviews are viewable by everyone" ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert reviews" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = (SELECT auth_id FROM public.users WHERE id = reviewer_id)
  );
