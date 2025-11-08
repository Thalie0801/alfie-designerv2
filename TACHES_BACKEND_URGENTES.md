# Tâches Backend Urgentes - Alfie Designer

## Date : 8 novembre 2025

---

## 📋 Liste des Tâches (5 problèmes critiques)

### ✅ Tâche 1 : Corriger le Studio vide

**Priorité** : 🔴 CRITIQUE

**Problème** :
- Le Studio n'affiche aucun job, seulement le bouton "Forcer le traitement"
- Les utilisateurs ne peuvent pas voir leurs générations en cours

**Diagnostic requis** :
- [ ] Vérifier que des jobs existent dans la table `job_queue` pour l'utilisateur de test
- [ ] Vérifier les logs de la requête SQL dans le Dashboard Supabase
- [ ] Tester la requête SQL manuellement dans l'éditeur SQL :
  ```sql
  SELECT * FROM job_queue 
  WHERE user_id = 'USER_ID_TEST' 
  ORDER BY created_at DESC 
  LIMIT 50;
  ```

**Actions à effectuer** :
- [ ] Vérifier les politiques RLS sur `job_queue` :
  ```sql
  -- Vérifier les politiques existantes
  SELECT * FROM pg_policies WHERE tablename = 'job_queue';
  
  -- Si nécessaire, ajouter une politique de lecture
  CREATE POLICY "Users can view their own jobs"
  ON job_queue FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
  ```

- [ ] Vérifier les politiques RLS sur `media_generations` :
  ```sql
  -- Vérifier les politiques existantes
  SELECT * FROM pg_policies WHERE tablename = 'media_generations';
  
  -- Si nécessaire, ajouter une politique de lecture
  CREATE POLICY "Users can view their own media"
  ON media_generations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
  ```

- [ ] Tester le Studio après correction des politiques RLS

**Fichiers concernés** :
- Base de données : `job_queue`, `media_generations`
- Frontend : `src/features/studio/ChatGenerator.tsx` (déjà correct)

---

### ✅ Tâche 2 : Ajouter les aperçus dans la bibliothèque

**Priorité** : 🟠 HAUTE

**Problème** :
- Les carrousels dans la bibliothèque n'affichent pas d'aperçus
- Les utilisateurs ne peuvent pas prévisualiser leurs carrousels

**Actions à effectuer** :
- [ ] Vérifier que la colonne `thumbnail_url` existe dans `media_generations` :
  ```sql
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'media_generations' 
  AND column_name = 'thumbnail_url';
  ```

- [ ] Modifier l'edge function `alfie-render-carousel-slide` pour générer un thumbnail :
  ```typescript
  // Dans supabase/functions/alfie-render-carousel-slide/index.ts
  
  // Après génération du slide, créer un thumbnail
  const thumbnailUrl = buildCloudinaryUrl({
    publicId: slidePublicId,
    transformations: [
      { width: 400, height: 400, crop: 'fill' },
      { quality: 'auto', fetch_format: 'auto' }
    ]
  });
  
  // Sauvegarder le thumbnail dans media_generations
  await supabase
    .from('media_generations')
    .update({ thumbnail_url: thumbnailUrl })
    .eq('id', mediaId);
  ```

- [ ] Tester la génération d'un nouveau carrousel
- [ ] Vérifier que le thumbnail s'affiche dans la bibliothèque

**Fichiers concernés** :
- `supabase/functions/alfie-render-carousel-slide/index.ts`
- Base de données : `media_generations.thumbnail_url`

---

### ✅ Tâche 3 : Corriger les carrousels cassés

**Priorité** : 🔴 CRITIQUE

**Problème** :
- Les textes sur les slides sont tronqués et illisibles
- Les liens Cloudinary sont visibles sur les slides au lieu d'être masqués

**Actions à effectuer** :
- [ ] Modifier l'edge function `alfie-render-carousel-slide` pour limiter la longueur des textes :
  ```typescript
  // Dans supabase/functions/alfie-render-carousel-slide/index.ts
  
  // Limiter la longueur des textes pour éviter les débordements
  const title = (slideContent.title || '').substring(0, 50);
  const subtitle = (slideContent.subtitle || '').substring(0, 100);
  const bullets = (slideContent.bullets || []).map(b => b.substring(0, 80));
  
  // Construire les overlays avec les textes tronqués
  const overlays = [
    // Title overlay
    {
      overlay: {
        text: {
          text: title,
          font_family: 'Arial',
          font_size: 70,
          font_weight: 'bold'
        }
      },
      color: '#FFFFFF',
      gravity: 'north',
      y: 200
    },
    // Subtitle overlay
    {
      overlay: {
        text: {
          text: subtitle,
          font_family: 'Arial',
          font_size: 50
        }
      },
      color: '#FFFFFF',
      gravity: 'north',
      y: 300
    }
    // ... bullets
  ];
  ```

- [ ] S'assurer que les URLs ne sont pas affichées sur les slides :
  ```typescript
  // Vérifier qu'aucun overlay ne contient d'URL
  // Les overlays doivent contenir uniquement du texte formaté
  ```

- [ ] Tester la génération d'un nouveau carrousel
- [ ] Vérifier que les textes sont complets et lisibles
- [ ] Vérifier qu'aucune URL n'est visible sur les slides

**Fichiers concernés** :
- `supabase/functions/alfie-render-carousel-slide/index.ts`
- `src/lib/cloudinary/imageUrls.ts` (déjà correct avec base64)

---

### ✅ Tâche 4 : Corriger la génération vidéo

**Priorité** : 🟠 HAUTE

**Problème** :
- Le bouton "Créer une vidéo" redirige vers une URL Cloudinary brute
- Les utilisateurs ne peuvent pas générer de vidéos depuis les carrousels

**Actions à effectuer** :
- [ ] Identifier le composant qui affiche le bouton "Créer une vidéo" :
  ```bash
  # Chercher dans le code
  grep -r "Créer une vidéo" src/
  ```

- [ ] Remplacer le lien `<a href="...">` par un bouton qui appelle une edge function :
  ```typescript
  // Avant (incorrect)
  <a href={cloudinaryVideoUrl} target="_blank">Créer une vidéo</a>
  
  // Après (correct)
  <Button onClick={handleGenerateVideo}>Créer une vidéo</Button>
  
  const handleGenerateVideo = async () => {
    const { data, error } = await supabase.functions.invoke('generate-carousel-video', {
      body: { carousel_id: carouselId }
    });
    
    if (error) {
      toast.error('Erreur lors de la génération de la vidéo');
      return;
    }
    
    toast.success('Vidéo en cours de génération...');
    // Rediriger vers le Studio pour suivre la progression
    navigate('/studio?order=' + data.order_id);
  };
  ```

- [ ] Créer une edge function `generate-carousel-video` :
  ```typescript
  // supabase/functions/generate-carousel-video/index.ts
  
  import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
  import { createClient } from '@supabase/supabase-js';
  
  serve(async (req) => {
    const { carousel_id } = await req.json();
    
    // 1. Récupérer les slides du carrousel
    const { data: slides } = await supabase
      .from('carousel_slides')
      .select('*')
      .eq('carousel_id', carousel_id)
      .order('position');
    
    // 2. Créer un job de génération vidéo
    const { data: job } = await supabase
      .from('job_queue')
      .insert({
        type: 'stitch_carousel_video',
        payload: { carousel_id, slides },
        status: 'queued'
      })
      .select()
      .single();
    
    return new Response(JSON.stringify({ 
      order_id: job.order_id,
      job_id: job.id 
    }));
  });
  ```

- [ ] Tester la génération vidéo depuis la bibliothèque
- [ ] Vérifier que le job est créé et apparaît dans le Studio

**Fichiers concernés** :
- Composant bibliothèque (à identifier)
- `supabase/functions/generate-carousel-video/index.ts` (à créer)

---

### ✅ Tâche 5 : Corriger l'upload de fichiers

**Priorité** : 🔴 CRITIQUE

**Problème** :
- L'upload de fichiers ouvre un nouvel onglet au lieu d'uploader
- Les utilisateurs ne peuvent pas importer d'images/vidéos dans le chat

**Actions à effectuer** :
- [ ] Appliquer la migration SQL `fix_upload_rls.sql` sur Supabase :
  
  **Option 1 : Via Supabase CLI (recommandé)**
  ```bash
  # Depuis votre machine locale
  supabase db push
  ```
  
  **Option 2 : Via le Dashboard Supabase**
  1. Ouvrir le Dashboard Supabase
  2. Aller dans "SQL Editor"
  3. Copier-coller le contenu de `supabase/migrations/fix_upload_rls.sql`
  4. Exécuter le SQL

- [ ] Vérifier que le bucket `chat-uploads` existe :
  ```sql
  SELECT * FROM storage.buckets WHERE name = 'chat-uploads';
  ```
  
  Si le bucket n'existe pas, le créer :
  ```sql
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('chat-uploads', 'chat-uploads', false);
  ```

- [ ] Vérifier les politiques RLS du bucket :
  ```sql
  SELECT * FROM storage.policies WHERE bucket_id = 'chat-uploads';
  ```

- [ ] Tester l'upload d'une image dans le chat
- [ ] Vérifier que le fichier est bien uploadé dans le bucket
- [ ] Vérifier que l'aperçu s'affiche correctement

**Fichiers concernés** :
- `supabase/migrations/fix_upload_rls.sql` (à appliquer)
- Base de données : `storage.buckets`, `storage.objects`
- Frontend : `src/lib/chatUploads.ts` (déjà correct)

---

## 🧪 Tests de Validation

Après avoir effectué toutes les corrections, tester les scénarios suivants :

### Scénario 1 : Studio
- [ ] Ouvrir le Studio
- [ ] Vérifier que les jobs s'affichent
- [ ] Vérifier que les assets s'affichent

### Scénario 2 : Bibliothèque
- [ ] Ouvrir la bibliothèque
- [ ] Vérifier que les carrousels ont des aperçus
- [ ] Cliquer sur un carrousel
- [ ] Vérifier que les slides sont lisibles (textes complets, pas d'URLs)

### Scénario 3 : Génération vidéo
- [ ] Ouvrir un carrousel dans la bibliothèque
- [ ] Cliquer sur "Créer une vidéo"
- [ ] Vérifier qu'un job est créé dans le Studio
- [ ] Vérifier que la vidéo est générée

### Scénario 4 : Upload
- [ ] Ouvrir le chat Alfie
- [ ] Cliquer sur le bouton d'upload (trombone)
- [ ] Sélectionner une image
- [ ] Vérifier que l'image est uploadée
- [ ] Vérifier que l'aperçu s'affiche dans le chat

---

## 📊 Suivi de Progression

- [ ] Tâche 1 : Studio vide (RLS)
- [ ] Tâche 2 : Aperçus bibliothèque (edge function)
- [ ] Tâche 3 : Carrousels cassés (edge function)
- [ ] Tâche 4 : Génération vidéo (edge function)
- [ ] Tâche 5 : Upload (migration SQL)

---

## 📞 Contact

Pour toute question ou problème, consulter le rapport complet dans `HOTFIX_REGRESSIONS_URGENTES.md`.
