-- Fix quota_woofs for existing brand with 0 woofs
-- Set to 1000 (Studio plan default) for the brand
UPDATE brands 
SET quota_woofs = 1000 
WHERE quota_woofs = 0 OR quota_woofs IS NULL;

-- Ensure new brands get correct default woofs based on plan
-- This is a safeguard for future brand creation
UPDATE brands 
SET quota_woofs = CASE 
  WHEN plan = 'starter' THEN 150
  WHEN plan = 'pro' THEN 450
  WHEN plan = 'studio' THEN 1000
  ELSE 150
END
WHERE quota_woofs IS NULL;