/**
 * alfie-proofread-fr
 * 
 * Correcteur orthographique français
 * 
 * ARCHITECTURE:
 * - Priorité 1: Vertex AI Gemini 2.5 Flash Lite
 * - Priorité 2: Lovable AI (fallback uniquement)
 */

import { edgeHandler } from '../_shared/edgeHandler.ts';
import { LOVABLE_API_KEY } from '../_shared/env.ts';
import { callVertexGeminiText, isVertexGeminiTextConfigured } from '../_shared/vertexGeminiText.ts';

export default {
  fetch: (req: Request) => edgeHandler(req, async ({ input }) => {
    const { title, subtitle } = input;

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

    let content = '';

    // Priorité 1: Vertex AI Gemini Flash Lite (économique)
    if (isVertexGeminiTextConfigured()) {
      console.log("[Proofread] 🎯 Using Vertex AI Gemini Flash Lite...");
      const vertexResult = await callVertexGeminiText(systemPrompt, userPrompt, "flash-lite");
      if (vertexResult) {
        content = vertexResult;
      } else {
        console.log("[Proofread] ⚠️ Vertex AI failed, falling back to Lovable AI...");
      }
    }

    // Priorité 2: Lovable AI (fallback)
    if (!content) {
      if (!LOVABLE_API_KEY) {
        console.warn('[Proofread] No API key available, returning original');
        return { title: title || '', subtitle: subtitle || '' };
      }

      console.log("[Proofread] 🔄 Using Lovable AI fallback...");
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
        console.error('[Proofread] Lovable AI error:', errorText);
        return { title: title || '', subtitle: subtitle || '' };
      }

      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    }
    
    try {
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

    return { title: title || '', subtitle: subtitle || '' };
  })
};
