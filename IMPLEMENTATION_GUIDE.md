# Guide d'Implémentation - Agent Alfie + Higgsfield + Bibliothèque

Ce document contient tous les fichiers à créer pour implémenter les fonctionnalités demandées.

## 📋 Vue d'Ensemble

### Fonctionnalités à Implémenter

1. **Agent Conversationnel OpenAI** - Un agent intelligent qui analyse les demandes et génère des directives précises
2. **Intégration Higgsfield** - Remplacement de Hugging Face par Higgsfield pour la génération de vidéos
3. **Service d'Upload Supabase** - Gestion intelligente des uploads vers Supabase Storage
4. **Système de Bibliothèque** - Stockage des générations avec rétention de 30 jours
5. **Service de Téléchargement** - Téléchargement d'images, vidéos et carrousels

### Variables d'Environnement Requises

Ajoutez ces variables dans Lovable.dev :

```env
# OpenAI (pour l'agent conversationnel)
VITE_OPENAI_API_KEY=sk-...

# Higgsfield (pour la génération de vidéos)
VITE_HIGGSFIELD_API_KEY=...

# Supabase (déjà configuré normalement)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## 📁 Fichiers à Créer

### 1. Configuration Supabase Storage

**Fichier:** `src/lib/supabase.ts` (à mettre à jour)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configuration des buckets pour les uploads
export const STORAGE_BUCKETS = {
  GENERATED_IMAGES: 'generated-images',
  GENERATED_VIDEOS: 'generated-videos',
  USER_UPLOADS: 'user-uploads'
} as const;

// Fonction utilitaire pour initialiser les buckets
export async function initializeStorageBuckets() {
  const buckets = Object.values(STORAGE_BUCKETS);
  
  for (const bucketName of buckets) {
    const { data: existingBucket } = await supabase
      .storage
      .getBucket(bucketName);
    
    if (!existingBucket) {
      const { error } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/webp',
          'image/gif',
          'video/mp4',
          'video/webm'
        ]
      });
      
      if (error) {
        console.error(`Error creating bucket ${bucketName}:`, error);
      } else {
        console.log(`✅ Bucket ${bucketName} created`);
      }
    }
  }
}
```

---

### 2. Service d'Upload

**Fichier:** `src/services/uploadService.ts`

```typescript
import { supabase, STORAGE_BUCKETS } from '@/lib/supabase';

export interface UploadOptions {
  bucket: keyof typeof STORAGE_BUCKETS;
  file: Blob | File;
  path?: string;
  metadata?: Record<string, any>;
}

export interface UploadResult {
  url: string;
  path: string;
  bucket: string;
}

export class UploadService {
  /**
   * Upload un fichier vers Supabase Storage
   */
  async uploadFile(options: UploadOptions): Promise<UploadResult> {
    const { bucket, file, path, metadata } = options;
    const bucketName = STORAGE_BUCKETS[bucket];
    
    const fileName = path || this.generateFileName(file);
    
    console.log(`📤 Uploading to ${bucketName}/${fileName}...`);

    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
          ...(metadata && { metadata })
        });

      if (error) {
        console.error('Upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(data.path);

      console.log('✅ Upload successful:', publicUrl);

      return {
        url: publicUrl,
        path: data.path,
        bucket: bucketName
      };

    } catch (error) {
      console.error('Upload service error:', error);
      throw error;
    }
  }

  /**
   * Upload depuis une URL
   */
  async uploadFromUrl(
    url: string,
    bucket: keyof typeof STORAGE_BUCKETS,
    fileName?: string
  ): Promise<UploadResult> {
    console.log(`📥 Downloading from ${url}...`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      return await this.uploadFile({
        bucket,
        file: blob,
        path: fileName
      });

    } catch (error) {
      console.error('Upload from URL error:', error);
      throw error;
    }
  }

  /**
   * Upload depuis Base64
   */
  async uploadFromBase64(
    base64: string,
    bucket: keyof typeof STORAGE_BUCKETS,
    mimeType: string = 'image/png',
    fileName?: string
  ): Promise<UploadResult> {
    console.log('📥 Converting base64 to blob...');

    try {
      const byteString = atob(base64.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([ab], { type: mimeType });

      return await this.uploadFile({
        bucket,
        file: blob,
        path: fileName
      });

    } catch (error) {
      console.error('Upload from base64 error:', error);
      throw error;
    }
  }

  /**
   * Supprimer un fichier
   */
  async deleteFile(bucket: keyof typeof STORAGE_BUCKETS, path: string): Promise<void> {
    const bucketName = STORAGE_BUCKETS[bucket];
    
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([path]);

    if (error) {
      console.error('Delete error:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }

    console.log('🗑️ File deleted:', path);
  }

  /**
   * Générer un nom de fichier unique
   */
  private generateFileName(file: File | Blob): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const extension = file instanceof File 
      ? file.name.split('.').pop() 
      : this.getExtensionFromMimeType(file.type);
    
    return `${timestamp}-${random}.${extension}`;
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/webm': 'webm'
    };
    
    return extensions[mimeType] || 'bin';
  }
}

export const uploadService = new UploadService();
```

---

### 3. Service de Téléchargement

**Fichier:** `src/services/downloadService.ts`

```typescript
export interface DownloadOptions {
  url: string;
  fileName: string;
  fileType: 'image' | 'video' | 'carousel';
}

export class DownloadService {
  /**
   * Télécharge un fichier depuis une URL
   */
  async downloadFile(options: DownloadOptions): Promise<void> {
    const { url, fileName, fileType } = options;
    
    try {
      console.log(`📥 Downloading ${fileType}:`, fileName);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = this.sanitizeFileName(fileName);
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);

      console.log('✅ Download initiated:', fileName);

    } catch (error) {
      console.error('Download error:', error);
      throw new Error(`Failed to download ${fileName}`);
    }
  }

  /**
   * Télécharge un carrousel complet (ZIP)
   */
  async downloadCarousel(images: string[], carouselName: string): Promise<void> {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      console.log(`📦 Creating carousel archive: ${carouselName}`);

      for (let i = 0; i < images.length; i++) {
        const response = await fetch(images[i]);
        const blob = await response.blob();
        zip.file(`slide-${i + 1}.png`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      const blobUrl = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${carouselName}.zip`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);

      console.log('✅ Carousel downloaded:', carouselName);

    } catch (error) {
      console.error('Carousel download error:', error);
      throw error;
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-z0-9.-]/gi, '_')
      .toLowerCase();
  }
}

export const downloadService = new DownloadService();
```

---

### 4. Service de Bibliothèque

**Fichier:** `src/services/libraryService.ts`

```typescript
import { supabase } from '@/lib/supabase';

export interface Generation {
  id: string;
  user_id: string;
  type: 'image' | 'video' | 'carousel';
  prompt: string;
  file_url: string;
  file_urls?: string[];
  brand_kit?: any;
  directive?: any;
  file_size?: number;
  mime_type?: string;
  created_at: string;
  expires_at: string;
  download_count: number;
  last_downloaded_at?: string;
}

export class LibraryService {
  /**
   * Sauvegarder une génération dans la bibliothèque
   */
  async saveGeneration(
    type: 'image' | 'video' | 'carousel',
    fileUrl: string | string[],
    prompt: string,
    directive?: any,
    brandKit?: any
  ): Promise<Generation> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const generationData = {
        user_id: user.id,
        type,
        prompt,
        file_url: Array.isArray(fileUrl) ? fileUrl[0] : fileUrl,
        file_urls: Array.isArray(fileUrl) ? fileUrl : null,
        brand_kit: brandKit,
        directive: directive,
        mime_type: type === 'video' ? 'video/mp4' : 'image/png'
      };

      const { data, error } = await supabase
        .from('generations')
        .insert(generationData)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Generation saved to library:', data.id);
      return data;

    } catch (error) {
      console.error('Failed to save generation:', error);
      throw error;
    }
  }

  /**
   * Récupérer toutes les générations de l'utilisateur
   */
  async getGenerations(
    filters?: {
      type?: 'image' | 'video' | 'carousel';
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<Generation[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      if (filters?.search) {
        query = query.textSearch('search_vector', filters.search);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      if (filters?.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];

    } catch (error) {
      console.error('Failed to get generations:', error);
      throw error;
    }
  }

  /**
   * Incrémenter le compteur de téléchargement
   */
  async incrementDownloadCount(generationId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('increment_download_count', {
        generation_id: generationId
      });

      if (error) throw error;

    } catch (error) {
      console.error('Failed to increment download count:', error);
    }
  }

  /**
   * Supprimer une génération
   */
  async deleteGeneration(generationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('generations')
        .delete()
        .eq('id', generationId);

      if (error) throw error;

      console.log('🗑️ Generation deleted:', generationId);

    } catch (error) {
      console.error('Failed to delete generation:', error);
      throw error;
    }
  }
}

export const libraryService = new LibraryService();
```

---

### 5. Générateur Higgsfield

**Fichier:** `src/services/generators/higgsfieldVideoGenerator.ts`

```typescript
import { uploadService } from '@/services/uploadService';

export interface VideoDirective {
  prompt: string;
  brandGuidelines: {
    colors: string[];
    fonts: string[];
    style: string;
    tone: string;
  };
  specifications: {
    duration?: number;
    aspectRatio?: string;
    frameRate?: number;
  };
}

export class HiggsfieldVideoGenerator {
  private apiKey: string;
  private apiUrl: string = 'https://api.higgsfield.ai/v1/generate'; // URL hypothétique

  constructor() {
    this.apiKey = import.meta.env.VITE_HIGGSFIELD_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ HIGGSFIELD_API_KEY not configured');
    }
  }

  async generate(directive: VideoDirective): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Higgsfield API key not configured');
    }

    const enrichedPrompt = this.buildVideoPrompt(directive);
    
    console.log('🎬 Generating video with Higgsfield:', {
      prompt: enrichedPrompt,
      duration: directive.specifications.duration
    });

    try {
      // Appel à l'API Higgsfield
      // NOTE: Cette implémentation est hypothétique et doit être ajustée
      // selon la vraie documentation API de Higgsfield
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: enrichedPrompt,
          duration: directive.specifications.duration || 5,
          aspect_ratio: directive.specifications.aspectRatio || '16:9',
          fps: directive.specifications.frameRate || 24,
          style: directive.brandGuidelines.style,
          color_palette: directive.brandGuidelines.colors
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Higgsfield API Error: ${error}`);
      }

      const data = await response.json();
      
      // Selon l'API, la réponse peut contenir une URL ou des bytes
      let finalUrl: string;
      
      if (data.videoUrl) {
        // Si c'est une URL temporaire, télécharger et upload vers Supabase
        console.log('💾 Downloading and uploading to Supabase...');
        const uploadResult = await uploadService.uploadFromUrl(
          data.videoUrl,
          'GENERATED_VIDEOS',
          `video-${Date.now()}.mp4`
        );
        finalUrl = uploadResult.url;
      } else if (data.videoBase64) {
        // Si c'est du base64
        const uploadResult = await uploadService.uploadFromBase64(
          data.videoBase64,
          'GENERATED_VIDEOS',
          'video/mp4',
          `video-${Date.now()}.mp4`
        );
        finalUrl = uploadResult.url;
      } else {
        throw new Error('No video data returned from Higgsfield');
      }

      console.log('✅ Video uploaded:', finalUrl);
      return finalUrl;

    } catch (error) {
      console.error('Higgsfield video generation error:', error);
      throw error;
    }
  }

  private buildVideoPrompt(directive: VideoDirective): string {
    const { prompt, brandGuidelines } = directive;
    
    return `${prompt}

Camera movement: smooth, cinematic
Visual style: ${brandGuidelines.style}
Color grading: ${brandGuidelines.colors.join(', ')} tones
Lighting: professional, ${brandGuidelines.tone}
Motion: fluid, coherent, high quality
Duration: ${directive.specifications.duration}s
Language: French`;
  }
}

export const higgsfieldVideoGenerator = new HiggsfieldVideoGenerator();
```

---

### 6. Agent OpenAI

**Fichier:** `src/services/agent/openAIAgent.ts`

```typescript
import OpenAI from 'openai';

export interface BrandKit {
  colors: string[];
  fonts: string[];
  style: string;
  tone: string;
  niche?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentContext {
  brandKit: BrandKit;
  userMessage: string;
  conversationHistory: Message[];
  uploadedImage?: string;
}

export interface GenerationDirective {
  type: 'image' | 'carousel' | 'video';
  prompt: string;
  reasoning: string;
  brandGuidelines: {
    colors: string[];
    fonts: string[];
    style: string;
    tone: string;
  };
  specifications: {
    dimensions?: string;
    aspectRatio?: string;
    duration?: number;
    slideCount?: number;
    frameRate?: number;
  };
}

export class OpenAIAgent {
  private openai: OpenAI;

  constructor() {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    
    this.openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true // Pour utilisation côté client
    });
  }

  async analyzeRequest(context: AgentContext): Promise<GenerationDirective> {
    const systemPrompt = `Tu es un agent AI expert en création de contenu visuel et direction artistique.

BRAND KIT ACTUEL:
- Niche: ${context.brandKit.niche || 'Non spécifiée'}
- Couleurs principales: ${context.brandKit.colors.join(', ')}
- Polices: ${context.brandKit.fonts.join(', ')}
- Style visuel: ${context.brandKit.style}
- Ton de communication: ${context.brandKit.tone}

${context.uploadedImage ? `IMAGE DE RÉFÉRENCE UPLOADÉE: ${context.uploadedImage}` : ''}

TÂCHE:
Analyse la demande de l'utilisateur et génère des directives ULTRA-PRÉCISES pour les APIs de génération.

IMPORTANT - SPÉCIFICITÉS DES APIs:
1. IMAGES (Gemini): Supporte des prompts détaillés, styles artistiques
2. CAROUSEL: Série d'images cohérentes avec transition narrative (5 slides)
3. VIDÉO (Higgsfield): Nécessite des prompts très descriptifs pour la cohérence temporelle

LANGUE:
- Tous les contenus doivent être en FRANÇAIS
- Les prompts peuvent être en anglais pour l'IA mais le contenu final doit être en français

RÉPONDS UNIQUEMENT EN JSON (sans backticks):
{
  "type": "image" | "carousel" | "video",
  "prompt": "Description ultra-détaillée optimisée pour l'API cible, en anglais pour l'IA",
  "reasoning": "Explication de tes choix stratégiques en français",
  "brandGuidelines": {
    "colors": ["#hex1", "#hex2"],
    "fonts": ["Font1", "Font2"],
    "style": "description du style",
    "tone": "ton de communication"
  },
  "specifications": {
    "dimensions": "1024x1024" (pour image),
    "aspectRatio": "16:9" (pour vidéo),
    "duration": 5 (pour vidéo, en secondes),
    "slideCount": 5 (pour carousel),
    "frameRate": 24 (pour vidéo)
  }
}`;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...context.conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: "user", content: context.userMessage }
    ];

    const response = await this.openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI agent');
    }

    const directive = JSON.parse(content) as GenerationDirective;
    
    console.log('🤖 Agent Decision:', {
      type: directive.type,
      reasoning: directive.reasoning
    });

    return directive;
  }

  enrichPromptWithBrandKit(
    basePrompt: string, 
    brandKit: BrandKit,
    uploadedImage?: string
  ): string {
    let enrichedPrompt = `${basePrompt}

Style Guide:
- Color palette: ${brandKit.colors.join(', ')}
- Visual style: ${brandKit.style}
- Aesthetic: ${brandKit.tone}
- Typography feeling: ${brandKit.fonts.join(', ')}`;

    if (brandKit.niche) {
      enrichedPrompt += `\n- Niche: ${brandKit.niche}`;
    }

    if (uploadedImage) {
      enrichedPrompt = `Reference image: ${uploadedImage}\n\n${enrichedPrompt}`;
    }

    return enrichedPrompt;
  }
}

export const openAIAgent = new OpenAIAgent();
```

---

### 7. Migration SQL pour la Table Generations

**Fichier:** `supabase/migrations/20250102_create_generations_table.sql`

```sql
-- Créer la table generations
CREATE TABLE IF NOT EXISTS public.generations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Informations sur la génération
    type TEXT NOT NULL CHECK (type IN ('image', 'video', 'carousel')),
    prompt TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_urls TEXT[], -- Pour les carrousels
    
    -- Métadonnées
    brand_kit JSONB,
    directive JSONB,
    file_size BIGINT,
    mime_type TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    
    -- Stats
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ,
    
    -- Indexation
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('french', prompt)
    ) STORED
);

-- Index pour la recherche
CREATE INDEX idx_generations_user_id ON public.generations(user_id);
CREATE INDEX idx_generations_type ON public.generations(type);
CREATE INDEX idx_generations_created_at ON public.generations(created_at DESC);
CREATE INDEX idx_generations_expires_at ON public.generations(expires_at);
CREATE INDEX idx_generations_search ON public.generations USING GIN(search_vector);

-- Politiques de sécurité (RLS)
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs propres générations
CREATE POLICY "Users can view own generations"
ON public.generations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Les utilisateurs peuvent créer leurs propres générations
CREATE POLICY "Users can create own generations"
ON public.generations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent supprimer leurs propres générations
CREATE POLICY "Users can delete own generations"
ON public.generations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Les utilisateurs peuvent mettre à jour leurs propres générations
CREATE POLICY "Users can update own generations"
ON public.generations FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Fonction pour incrémenter le compteur de téléchargement
CREATE OR REPLACE FUNCTION increment_download_count(generation_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.generations
  SET 
    download_count = download_count + 1,
    last_downloaded_at = NOW()
  WHERE id = generation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🔧 Intégration dans AlfieChat.tsx

Pour intégrer l'agent dans le chat Alfie, modifiez `src/components/AlfieChat.tsx` :

```typescript
import { openAIAgent } from '@/services/agent/openAIAgent';
import { higgsfieldVideoGenerator } from '@/services/generators/higgsfieldVideoGenerator';
import { libraryService } from '@/services/libraryService';
import { downloadService } from '@/services/downloadService';

// Dans la fonction handleSend, avant la génération:
const directive = await openAIAgent.analyzeRequest({
  brandKit: {
    colors: activeBrand?.primary_color ? [activeBrand.primary_color] : [],
    fonts: activeBrand?.font ? [activeBrand.font] : [],
    style: activeBrand?.style || 'modern',
    tone: activeBrand?.tone || 'professional',
    niche: activeBrand?.niche
  },
  userMessage: input,
  conversationHistory: messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content
  })),
  uploadedImage: uploadedImage || undefined
});

console.log('🤖 Agent directive:', directive);

// Utiliser directive.type pour déterminer quelle génération lancer
// Utiliser directive.prompt au lieu du prompt utilisateur brut
```

---

## 📦 Dépendances à Ajouter

Ajoutez ces dépendances dans `package.json` :

```json
{
  "dependencies": {
    "openai": "^4.47.1",
    "jszip": "^3.10.1"
  }
}
```

---

## ✅ Checklist d'Implémentation

1. [ ] Créer tous les fichiers de services listés ci-dessus
2. [ ] Ajouter les variables d'environnement dans Lovable.dev
3. [ ] Exécuter la migration SQL dans Supabase
4. [ ] Installer les dépendances npm
5. [ ] Intégrer l'agent dans AlfieChat.tsx
6. [ ] Tester la génération d'images avec l'agent
7. [ ] Tester la génération de vidéos avec Higgsfield
8. [ ] Tester la bibliothèque et le téléchargement
9. [ ] Initialiser les buckets Supabase Storage

---

## 📝 Notes Importantes

### Higgsfield API

L'implémentation de `higgsfieldVideoGenerator.ts` est **hypothétique** car la documentation API de Higgsfield n'est pas publiquement disponible. Vous devrez ajuster :

- L'URL de l'API (`apiUrl`)
- Le format de la requête (body)
- Le format de la réponse (data structure)
- Les paramètres supportés

Une fois que vous aurez accès à la vraie documentation Higgsfield, mettez à jour le fichier en conséquence.

### OpenAI Agent

L'agent utilise GPT-4o pour analyser les demandes. Assurez-vous que votre clé API OpenAI a accès à ce modèle.

### Supabase Storage

Les buckets doivent être créés manuellement dans Supabase ou via la fonction `initializeStorageBuckets()` appelée au démarrage de l'application.

---

## 🚀 Prochaines Étapes

1. Implémenter tous les fichiers dans Lovable.dev
2. Configurer les variables d'environnement
3. Tester chaque fonctionnalité individuellement
4. Ajuster l'intégration Higgsfield selon la vraie documentation
5. Optimiser les prompts de l'agent selon les résultats

---

**Auteur:** Manus AI  
**Date:** 2 novembre 2025  
**Version:** 1.0
