import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

import { corsHeaders } from "../_shared/cors.ts";
interface JobUpdate {
  status: JobStatus;
  progress?: number;
  output_data?: any;
  error?: string;
}

type JobStatus = 'pending' | 'queued' | 'running' | 'checking' | 'ready' | 'failed' | 'canceled';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const upgradeHeader = req.headers.get('upgrade') || '';
    
    if (upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket connection', { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let activeJobId: string | null = null;
    let pollInterval: number | null = null;

    socket.onopen = () => {
      console.log('WebSocket connected');
      socket.send(JSON.stringify({ type: 'connected' }));
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'subscribe' && message.jobId) {
          activeJobId = message.jobId;
          console.log(`Subscribed to job: ${activeJobId}`);

          // Clear existing interval
          if (pollInterval) {
            clearInterval(pollInterval);
          }

          // Start polling for job updates
          pollInterval = setInterval(async () => {
            if (!activeJobId) return;

            const { data: job, error } = await supabase
              .from('jobs')
              .select('*')
              .eq('id', activeJobId)
              .single();

            if (error) {
              console.error('Job fetch error:', error);
              socket.send(JSON.stringify({
                type: 'error',
                error: 'Failed to fetch job status'
              }));
              return;
            }

            if (!job) return;

            // Send update to client
            socket.send(JSON.stringify({
              type: 'job_update',
              jobId: job.id,
              shortId: job.short_id,
              status: job.status,
              progress: job.progress || 0,
              output_data: job.output_data,
              error: job.error
            }));

            // Stop polling if job is complete or failed
            if (['ready', 'failed', 'canceled'].includes(job.status)) {
              if (pollInterval) {
                clearInterval(pollInterval);
                pollInterval = null;
              }
              
              // Send completion event
              socket.send(JSON.stringify({
                type: 'job_complete',
                jobId: job.id,
                status: job.status,
                output_data: job.output_data
              }));
            }
          }, 2000); // Poll every 2 seconds
        }

        if (message.type === 'unsubscribe') {
          activeJobId = null;
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }

        if (message.type === 'cancel' && message.jobId) {
          // Update job status to canceled
          await supabase
            .from('jobs')
            .update({ status: 'canceled' })
            .eq('id', message.jobId);

          socket.send(JSON.stringify({
            type: 'job_canceled',
            jobId: message.jobId
          }));
        }
      } catch (error) {
        console.error('Message handling error:', error);
        socket.send(JSON.stringify({
          type: 'error',
          error: 'Failed to process message'
        }));
      }
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };

    return response;
  } catch (error) {
    console.error('WebSocket setup error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
