# Module VISION d'Alfie Designer

## Vue d'ensemble

Le module VISION est le système centralisé de transformation d'intents utilisateur en prompts structurés pour les moteurs de génération visuelle (Gemini Image, Replicate, Veo 3.1).

## Architecture

```
[Chat Widget / Studio] 
       ↓ UnifiedAlfieIntent
[alfie-vision] ← Module VISION
       ↓ VisionOutput (JSON structuré)
[alfie-job-worker]
       ↓ Dispatch par target
[gemini_image | replicate | veo_3_1]
```

## Formats de sortie

Le module VISION génère un JSON structuré selon le type de contenu :

### 1. Image Simple (`kind: "image"`)

```json
{
  "engine": "visual",
  "kind": "image",
  "target": "gemini_image",
  "model": "gemini-2.5-flash-image",
  "meta": {
    "platform": "instagram",
    "use_brand_kit": true
  },
  "images": [
    {
      "prompt": "Subject: A professional workspace with laptop and coffee...",
      "negative_prompt": "low quality, blurry, horror, text artifacts",
      "aspect_ratio": "1:1",
      "image_size": "2K",
      "count": 1,
      "style": "photorealistic",
      "text_layout": {
        "has_title": true,
        "has_body": false,
        "has_cta": true,
        "layout_hint": "empty space at top for title, main subject centered"
      },
      "text_source": "user"
    }
  ]
}
```

### 2. Carrousel (`kind: "carousel"`)

```json
{
  "engine": "visual",
  "kind": "carousel",
  "target": "gemini_image",
  "model": "gemini-2.5-flash-image",
  "slides": [
    {
      "id": "slide_1",
      "role": "hook",
      "image": {
        "prompt": "...",
        "aspect_ratio": "4:5",
        "style": "3d_pixar_style"
      },
      "text_layout": {
        "has_title": true,
        "layout_hint": "big bold title at center, clean background"
      },
      "text_source": "ai"
    }
  ]
}
```

### 3. Vidéo Standard (`kind: "video_standard"`)

```json
{
  "engine": "visual",
  "kind": "video_standard",
  "target": "replicate",
  "video": {
    "title": "Product Launch Video",
    "duration_seconds": 8,
    "aspect_ratio": "9:16",
    "style": "3d_pixar_style",
    "scenario": {
      "one_liner": "Smooth product reveal with dynamic lighting",
      "beats": [
        {
          "id": "beat_1",
          "time_range": [0, 4],
          "description": "Product rotating slowly in spotlight",
          "camera": "slow zoom in"
        }
      ]
    },
    "visual_prompt": "3D rendered product on clean background...",
    "negative_prompt": "low quality, blur, text artifacts"
  }
}
```

### 4. Vidéo Premium (`kind: "video_premium"`)

```json
{
  "engine": "visual",
  "kind": "video_premium",
  "target": "veo_3_1",
  "video": {
    "duration_seconds": 20,
    "style": "cinematic_photorealistic",
    "scenario": {
      "beats": [
        {
          "id": "beat_1",
          "time_range": [0, 5],
          "description": "Wide establishing shot, golden hour lighting",
          "camera": "cinematic pan"
        }
      ]
    }
  }
}
```

## Gestion du Brand Kit

### Si `brand.useBrandKit = true` :
- Les couleurs de la marque sont intégrées dans les prompts (décor, vêtements, UI)
- Le ton de la marque influence le style visuel
- Pas de mention explicite de logo/marque (géré séparément)

### Si `brand.useBrandKit = false` :
- Palette neutre et générique
- Style adapté au sujet et à la plateforme

## Styles visuels disponibles

- `photorealistic` : Photo réaliste
- `cinematic_photorealistic` : Rendu cinématographique
- `3d_pixar_style` : Rendu 3D type Pixar
- `flat_illustration` : Illustration plate/vectorielle
- `minimalist_vector` : Minimaliste vectoriel
- `digital_painting` : Peinture numérique
- `comic_book` : Bande dessinée

## Ratios et plateformes

| Ratio | Utilisation |
|-------|-------------|
| 1:1   | Post Instagram carré, multi-usage |
| 4:5   | Carrousel Instagram |
| 9:16  | Stories/Reels/TikTok/Shorts (vertical) |
| 16:9  | YouTube horizontal, bannière |

## Règles de sécurité

Le module VISION applique automatiquement :
- ✅ Pas d'enfants ni de mineurs
- ✅ Pas de célébrités ou personnages protégés
- ✅ Pas de violence/gore/contenu choquant
- ✅ Pas de style horreur ou distorsions
- ✅ Negative prompts anti-artefacts systématiques

## Intégration

### Appeler le module VISION

```typescript
const { data, error } = await supabase.functions.invoke('alfie-vision', {
  body: {
    intent: {
      kind: 'image',
      platform: 'instagram',
      prompt: 'Un bureau moderne avec café',
      ratio: '1:1'
    },
    brand: {
      name: 'Ma Marque',
      colors: { primary: '#FF6B6B' },
      useBrandKit: true
    },
    textSource: 'user'
  }
});

const visionOutput: VisionOutput = data;
```

### Utiliser le VisionOutput

```typescript
if (visionOutput.kind === 'image' && visionOutput.images) {
  const imageSpec = visionOutput.images[0];
  // Utiliser imageSpec.prompt pour générer avec Gemini Image
  // Utiliser imageSpec.text_layout pour les overlays de texte
}
```

## Types TypeScript

Les types sont disponibles dans :
- Frontend : `src/lib/types/vision.ts`
- Backend : `supabase/functions/_shared/visionTypes.ts`

Import :
```typescript
import type { VisionOutput, VisionRequest } from '@/lib/types/vision';
```

## Logs et débogage

Le module VISION log :
- Les paramètres d'entrée (kind, platform, useBrandKit)
- La longueur de la réponse AI brute
- Les détails de sortie (kind, target, counts)
- Les erreurs de parsing/validation JSON

Rechercher dans les logs : `[alfie-vision]`

## Performance

- Temps de réponse moyen : 2-5 secondes
- Modèle utilisé : `google/gemini-2.5-flash`
- Retry automatique en cas d'échec de parsing JSON

## Roadmap

- [ ] Cache des prompts récents
- [ ] Support multi-langue pour les briefs
- [ ] Suggestions de variations de style
- [ ] Optimisation des prompts par A/B testing
