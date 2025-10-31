import { edgeHandler } from '../_shared/edgeHandler.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

export default {
  async fetch(req: Request) {
    return edgeHandler(req, async ({ jwt, input }) => {
      if (!jwt) throw new Error('MISSING_AUTH');

      const { provider, prompt, format = '1024x1024', brand_id, cost_woofs = 1 } = input;

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: `Bearer ${jwt}` } } }
      );

      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
      if (userError || !user) throw new Error('INVALID_TOKEN');

      // 1. Vérifier quota
      const { data: checkData, error: checkError } = await supabaseAuth.functions.invoke('alfie-check-quota', {
        body: { cost_woofs, brand_id },
      });

      if (checkError || !checkData?.ok || !checkData.data?.ok) {
        console.error('Quota check failed:', checkError, checkData);
        throw new Error('INSUFFICIENT_QUOTA');
      }

      // 2. Débiter (via RPC)
      const { error: consumeError } = await supabaseAdmin.rpc('consume_woofs', { 
        user_id_param: user.id, 
        woofs_amount: cost_woofs 
      });

      if (consumeError) {
        console.error('Failed to consume woofs:', consumeError);
        throw new Error('DEBIT_FAILED');
      }

      try {
        // 3. Génération IA
        const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
        if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY_MISSING');

        console.log('Generating image with prompt:', prompt);

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-image-preview',
            messages: [{ role: 'user', content: prompt }],
            modalities: ['image', 'text'],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('AI Gateway error:', response.status, errorText);
          throw new Error(`AI_GATEWAY_ERROR: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        
        if (!imageUrl) {
          console.error('No image in response:', JSON.stringify(data));
          throw new Error('NO_IMAGE_GENERATED');
        }

        // 4. Stocker la génération
        const { data: generation, error: insertError } = await supabaseAdmin
          .from('media_generations')
          .insert({
            user_id: user.id,
            brand_id: brand_id || null,
            type: 'image',
            modality: 'image',
            provider_id: provider || 'gemini-nano',
            prompt,
            output_url: imageUrl,
            render_url: imageUrl,
            status: 'completed',
            cost_woofs,
            params_json: { format },
          })
          .select()
          .single();

        if (insertError) {
          console.error('Failed to insert generation:', insertError);
          // Continue quand même, pas besoin de refund
        }

        return {
          image_urls: [imageUrl],
          generation_id: generation?.id,
          meta: { provider: provider || 'gemini-nano', format, cost: cost_woofs },
        };
      } catch (genError: any) {
        // 5. REMBOURSEMENT en cas d'échec
        console.error('[Render] Generation failed, refunding woofs:', genError);
        
        const { error: refundError } = await supabaseAdmin.rpc('refund_woofs', { 
          user_id_param: user.id, 
          woofs_amount: cost_woofs 
        });

        if (refundError) {
          console.error('Failed to refund woofs:', refundError);
        }

        throw genError;
      }
    });
  }
};
