-- Add RLS policy for users to view their own job steps
CREATE POLICY "Users can view their job steps" ON public.job_steps
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.job_queue jq 
    WHERE jq.id = job_steps.job_id 
    AND jq.user_id = auth.uid()
  )
);

-- Enable realtime for job_steps
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_steps;