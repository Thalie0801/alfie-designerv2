import { edgeHandler } from '../_shared/edgeHandler.ts';
import { LOVABLE_API_KEY } from '../_shared/env.ts';

export default {
  fetch: (req: Request) => edgeHandler(req, async ({ input }) => {
    const { title, subtitle } = input;

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Tu es un correcteur orthographique français.
Règles strictes:
- Corrige UNIQUEMENT l'orthographe et les accents français
- NE PAS reformuler, NE PAS traduire
- Retourner exactement le même texte avec corrections minimales
- Respecter la ponctuation et la casse d'origine
- Format JSON: {"title": "...", "subtitle": "..."}`;

    const userPrompt = `Corrige l'orthographe:
Title: ${title || ''}
Subtitle: ${subtitle || ''}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Proofread] AI gateway error:', errorText);
      // Fallback: retourner l'original
      return { title: title || '', subtitle: subtitle || '' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    try {
      // Extraire le JSON de la réponse
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: parsed.title || title || '',
          subtitle: parsed.subtitle || subtitle || ''
        };
      }
    } catch (e) {
      console.warn('[Proofread] JSON parse failed:', e);
    }

    // Fallback: retourner l'original
    return { title: title || '', subtitle: subtitle || '' };
  })
};
