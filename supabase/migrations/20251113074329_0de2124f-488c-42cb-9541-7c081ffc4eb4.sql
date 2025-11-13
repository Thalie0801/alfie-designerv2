-- Security Fix: Restrict overly permissive RLS policies to service_role only
-- This prevents potential exploitation if policies are accessible to other roles

-- Fix idempotency_keys policy
DROP POLICY IF EXISTS "Service can manage idempotency" ON public.idempotency_keys;
CREATE POLICY "Service role can manage idempotency" 
ON public.idempotency_keys 
FOR ALL 
TO service_role
USING (true) 
WITH CHECK (true);

-- Fix job_sets policy
DROP POLICY IF EXISTS "Service can manage job_sets" ON public.job_sets;
CREATE POLICY "Service role can manage job_sets" 
ON public.job_sets 
FOR ALL 
TO service_role
USING (true) 
WITH CHECK (true);

-- Add comment for future reference
COMMENT ON POLICY "Service role can manage idempotency" ON public.idempotency_keys IS 
'Security: Restricted to service_role only. Defense-in-depth measure.';

COMMENT ON POLICY "Service role can manage job_sets" ON public.job_sets IS 
'Security: Restricted to service_role only. Defense-in-depth measure.';