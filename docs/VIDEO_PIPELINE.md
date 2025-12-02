# Pipeline de Génération Vidéo - Alfie Designer

## Vue d'ensemble

Alfie Designer propose un système de génération vidéo unifié basé sur **Vertex AI Veo 3.1** uniquement.

## Architecture Vidéo Simplifiée

### Système Vidéo Unique : Veo 3.1 Premium

**Engine :** Vertex AI Veo 3.1 FAST  
**Modèle :** `veo-3.0-fast-generate-001`  
**Coût :** 25 Woofs par vidéo  
**Durée :** Jusqu'à 8 secondes  
**Résolution :** 1080p avec audio automatique  

## Configuration Vidéo

### Paramètres Veo 3.1

```typescript
// Paramètres de génération
{
  durationSeconds: 4 | 6 | 8,  // Durée validée
  storageUri: string,          // GCS bucket de destination
  prompt: string,              // Description de la vidéo
  sourceImageUrl?: string      // Image de référence optionnelle
}
```

### Flux de Génération Vidéo Premium

1. **Utilisateur** sélectionne "🎥 Vidéo premium (8s)" dans Studio
2. **alfie-job-worker** traite le job `video_premium`
3. **generate-video** Edge Function appelle Vertex AI Veo 3.1
4. **Polling** vérifie l'opération toutes les 10 secondes (max 5 minutes)
5. **Transfert GCS → Cloudinary** via Signed URL V4
6. **Sauvegarde** dans `media_generations` avec `type='video'`, `engine='veo_3.1'`

### Métadonnées Enregistrées

```typescript
{
  provider: "vertex_ai",
  tier: "premium",
  duration: 8,
  resolution: "1080p",
  model: "veo-3.0-fast-generate-001"
}
```

## Fichiers Modifiés

### Backend

- **supabase/functions/alfie-job-worker/index.ts** : Route uniquement `video_premium` vers `generate-video`
- **supabase/functions/generate-video/index.ts** : Génération Veo 3.1 uniquement
- **supabase/functions/_shared/woofsCosts.ts** : `video_premium: 25`

### Frontend

- **src/pages/StudioGenerator.tsx** : Option "🎥 Vidéo premium (8s)"
- **src/components/studio/PackAssetRow.tsx** : Label vidéo premium uniquement
- **src/lib/types/alfie.ts** : `AssetKind = 'image' | 'carousel' | 'video_premium'`

## Avantages du Pipeline Unifié

### Performance
- Génération de haute qualité systématique
- Mouvements fluides et naturels
- Audio généré automatiquement

### Coûts
- Tarification transparente : 25 Woofs par vidéo
- Pas de confusion entre tiers standard/premium

### UX
- Workflow simplifié : une seule option vidéo
- Expérience cohérente et prévisible
- Qualité professionnelle garantie

## Fonctions Edge Dépréciées

Les fonctions suivantes retournent **410 Gone** :

- `chat-generate-video` → Utiliser `/studio`
- `alfie-generate-video-slideshow` → Utiliser `/studio`
- `generate-sora-montage` → Utiliser `/studio`
- `create-video` → Utiliser `/studio`

**Alternative** : Toute génération vidéo passe par Studio Generator avec confirmation de coût via `IntentPanel`.

## Résolution des Problèmes

### URLs Cloudinary Cassées
✅ **Résolu** : Utilisation de Signed URLs GCS V4 pour transfert direct vers Cloudinary sans saturation mémoire Edge Function.

### Métadonnées Standardisées
Toutes les vidéos ont une structure cohérente :
```json
{
  "type": "video",
  "engine": "veo_3.1",
  "provider": "vertex_ai",
  "tier": "premium",
  "duration": 8,
  "resolution": "1080p"
}
```

## Étapes Futures (Optionnelles)

- Durées configurables (4s, 6s, 8s) avec tarification différenciée
- Génération de variantes vidéo
- Aperçus avant génération complète
- Traitement par batch
