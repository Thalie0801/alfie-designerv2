# Pipeline de Génération Vidéo - Alfie Designer

## Vue d'ensemble

Alfie Designer propose un système de génération vidéo unifié basé sur **Vertex AI Veo 3.1** uniquement, avec **génération audio automatique** (musique d'ambiance).

## Architecture Vidéo Simplifiée

### Système Vidéo Unique : Veo 3.1 Premium

**Engine :** Vertex AI Veo 3.1 FAST  
**Modèle :** `veo-3.0-fast-generate-001`  
**Coût :** 25 Woofs par asset vidéo  
**Durée :** 6-8 secondes par asset (défaut: 8s)  
**Résolution :** 1080p  
**Audio :** Musique d'ambiance générée automatiquement (activé par défaut)

## Configuration Vidéo

### Paramètres Veo 3.1

```typescript
// Paramètres de génération
{
  durationSeconds: 8,           // Durée par défaut (6-8s supporté)
  storageUri: string,           // GCS bucket de destination
  prompt: string,               // Description de la vidéo
  sourceImageUrl?: string,      // Image de référence optionnelle
  withAudio: true               // ✅ Audio ON par défaut
}
```

### Génération Audio

Veo 3.1 génère automatiquement une musique d'ambiance adaptée au contenu de la vidéo.

#### Flux Audio
```
PackPreparationModal (toggle "Musique auto 🎵")
  → sendPackToGenerator (withAudio: true/false)
  → job_queue.payload.withAudio
  → alfie-job-worker → generate-video
  → Vertex AI (generateAudio: true/false)
  → Vidéo avec/sans audio
```

#### Contrôle Utilisateur
- **Toggle visible** dans PackPreparationModal
- **ON par défaut** : "Musique auto 🎵"
- **OFF optionnel** : "Sans audio"

### Intégration Brand Kit

Le Brand Kit est entièrement intégré dans le prompt vidéo :
- **Couleurs** converties en descriptions (ex: "vibrant red and deep blue tones")
- **Niche** influence le contexte visuel
- **Visual mood** affecte la composition
- **Logs de diagnostic** pour vérification

```typescript
console.log("[processGenerateVideo] 🏢 Brand Kit check:", {
  useBrandKit,
  hasBrandMini: !!brandMini,
  brandNiche: brandMini?.niche,
  brandPalette: brandMini?.palette?.slice(0, 2),
  brandVisualMood: brandMini?.visual_mood,
});
```

### Flux de Génération Vidéo Premium

1. **Utilisateur** sélectionne "🎥 Asset vidéo" dans Studio ou accepte un pack Alfie
2. **PackPreparationModal** affiche le toggle audio (ON par défaut)
3. **alfie-job-worker** traite le job `generate_video` avec `engine: veo_3_1`
4. **generate-video** Edge Function appelle Vertex AI Veo 3.1 avec `generateAudio`
5. **Polling** vérifie l'opération toutes les 10 secondes (max 5 minutes)
6. **Vidéo uploadée sur GCS**, URL signée générée (7 jours)
7. **Sauvegarde** dans `media_generations` avec métadonnées complètes

### Métadonnées Enregistrées

```typescript
{
  type: "video",
  engine: "veo_3_1",
  provider: "vertex_ai",
  tier: "premium",
  duration: 8,
  resolution: "1080p",
  model: "veo-3.0-fast-generate-001",
  withAudio: true,
  referenceImageUrl: "...",  // Si image source fournie
  script: { hook, script, cta }  // Script vidéo si généré
}
```

## Fichiers Modifiés

### Backend

- **supabase/functions/alfie-job-worker/index.ts** : 
  - Route `generate_video` vers `generate-video`
  - Propage `withAudio` depuis le payload
  - Ajoute indices musique au prompt si audio activé
  - Logs Brand Kit pour diagnostic
- **supabase/functions/generate-video/index.ts** : 
  - Génération Veo 3.1 avec `generateAudio`
  - `withAudio !== false` (true par défaut)
- **supabase/functions/_shared/woofsCosts.ts** : `video_premium: 25`

### Frontend

- **src/config/systemConfig.ts** : `VEO3_WOOF_FACTOR: 25`, `VEO3_ENABLED: true`
- **src/utils/videoRouting.ts** : Route toujours vers `veo3`
- **src/lib/types/alfie.ts** : `withAudio?: boolean`, `engine?: string`
- **src/services/generatorFromChat.ts** : `withAudio: asset.withAudio ?? true`
- **src/components/chat/PackPreparationModal.tsx** : Toggle audio amélioré
- **src/components/chat/ChatWidget.tsx** : Propage `withAudio` depuis les assets

## Avantages du Pipeline Unifié

### Performance
- Génération rapide : 30-90 secondes
- URLs signées GCS V4 (pas de problème Cloudinary)
- Audio généré automatiquement

### Coûts
- Tarification transparente : 25 Woofs par vidéo
- Qualité premium systématique

### UX
- Toggle audio visible et intuitif
- Brand Kit appliqué automatiquement
- Logs détaillés pour debugging

## Dépannage

### Pas d'audio dans la vidéo
1. Vérifier `withAudio: true` dans le payload du job
2. Vérifier `generateAudio: true` dans les logs generate-video
3. Vérifier que la vidéo Veo 3.1 inclut une piste audio

### Brand Kit non appliqué
1. Vérifier `useBrandKit: true` dans le payload
2. Vérifier que la marque a palette/niche/visual_mood
3. Consulter les logs alfie-job-worker "Brand Kit check"

## Fonctions Edge Dépréciées

Les fonctions suivantes sont dépréciées :
- `chat-generate-video` → Utiliser `/studio`
- `alfie-generate-video-slideshow` → Utiliser `/studio`
- `generate-sora-montage` → Utiliser `/studio`

**Alternative** : Toute génération vidéo passe par Studio ou le chat Alfie avec Veo 3.1.
