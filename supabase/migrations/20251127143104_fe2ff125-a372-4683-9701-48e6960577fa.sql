-- Add status column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);