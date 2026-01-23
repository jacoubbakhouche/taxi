
-- Add columns for driver document verification
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS driving_license_url text,
ADD COLUMN IF NOT EXISTS carte_grise_url text,
ADD COLUMN IF NOT EXISTS documents_submitted boolean DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.users.is_verified IS 'True if admin has approved the driver';
COMMENT ON COLUMN public.users.documents_submitted IS 'True if driver has uploaded docs and is waiting approval';
