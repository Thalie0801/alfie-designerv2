# Architecture du Nouveau Chat Alfie (Simplifié)

## 🎯 Objectif

Créer un chat minimaliste et robuste qui gère uniquement 3 types de génération :
1. **Images** (via `alfie-render-image`)
2. **Vidéos** (via `generate-video`)
3. **Carrousels** (via `create-job-set` + `process-job-worker`)

---

## 📦 Edge Functions Nécessaires

### 1. **Génération d'Images**
- **Fonction** : `alfie-render-image`
- **Input** : `{ provider, prompt, format, brand_id, cost_woofs }`
- **Output** : `{ ok, data: { image_urls, generation_id } }`
- **Coût** : 1 Woof

### 2. **Génération de Vidéos**
- **Fonction** : `generate-video`
- **Input** : `{ prompt, aspectRatio, imageUrl?, brandId, woofCost }`
- **Output** : `{ jobId, predictionId }`
- **Coût** : Variable (1-3 Woofs selon durée)

### 3. **Génération de Carrousels**
- **Fonction** : `create-job-set`
- **Input** : `{ brandId, prompt, count, aspectRatio, styleRef? }`
- **Output** : `{ data: { id } }`
- **Coût** : 1 Visuel par slide

### 4. **Worker de Traitement**
- **Fonction** : `process-job-worker`
- **Input** : Aucun (traite les jobs en queue)
- **Output** : Jobs traités

### 5. **Gestion des Quotas**
- **Fonction** : `get-quota`
- **Input** : `{ brand_id }`
- **Output** : `{ woofs_remaining, visuals_remaining, ... }`

- **Fonction** : `alfie-consume-woofs`
- **Input** : `{ cost_woofs, brand_id }`
- **Output** : `{ ok }`

- **Fonction** : `alfie-consume-visuals`
- **Input** : `{ cost_visuals, brand_id }`
- **Output** : `{ ok }`

- **Fonction** : `alfie-refund-woofs`
- **Input** : `{ amount, brand_id }`
- **Output** : `{ ok }`

---

## 🏗️ Structure du Nouveau Code

### 1. **États du Composant**

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'image' | 'video' | 'carousel';
  assetUrl?: string;
  assetId?: string;
  metadata?: any;
}

const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState('');
const [isLoading, setIsLoading] = useState(false);
const [uploadedImage, setUploadedImage] = useState<string | null>(null);

// Carrousel tracking
const [activeJobSetId, setActiveJobSetId] = useState<string>('');
const [carouselTotal, setCarouselTotal] = useState(0);
const [carouselDone, setCarouselDone] = useState(0);
```

### 2. **Flux de Génération Simplifié**

#### A. **Génération d'Image**

```typescript
const generateImage = async (prompt: string, aspectRatio: string) => {
  // 1. Vérifier et consommer quota (1 Woof)
  const quotaOk = await checkAndConsumeQuota('woofs', 1);
  if (!quotaOk) return;
  
  // 2. Appeler alfie-render-image
  const { data, error } = await supabase.functions.invoke('alfie-render-image', {
    body: { provider: 'gemini-nano', prompt, format: aspectRatio, brand_id: activeBrandId, cost_woofs: 1 }
  });
  
  // 3. Gérer le résultat
  if (error) {
    await refundWoofs(1);
    showError(error);
    return;
  }
  
  // 4. Afficher l'image
  addMessage({
    role: 'assistant',
    content: 'Image générée !',
    type: 'image',
    assetUrl: data.data.image_urls[0],
    assetId: data.data.generation_id
  });
};
```

#### B. **Génération de Vidéo**

```typescript
const generateVideo = async (prompt: string, aspectRatio: string, woofCost: number) => {
  // 1. Vérifier et consommer quota
  const quotaOk = await checkAndConsumeQuota('woofs', woofCost);
  if (!quotaOk) return;
  
  // 2. Appeler generate-video
  const { data, error } = await supabase.functions.invoke('generate-video', {
    body: { prompt, aspectRatio, brandId: activeBrandId, woofCost }
  });
  
  // 3. Gérer le résultat
  if (error) {
    await refundWoofs(woofCost);
    showError(error);
    return;
  }
  
  // 4. Afficher le placeholder de job
  addMessage({
    role: 'assistant',
    content: 'Vidéo en cours de génération...',
    type: 'video',
    metadata: { jobId: data.jobId, status: 'processing' }
  });
  
  // 5. Polling du statut (via subscription ou polling)
  pollVideoStatus(data.jobId);
};
```

#### C. **Génération de Carrousel**

```typescript
const generateCarousel = async (prompt: string, count: number, aspectRatio: string) => {
  // 1. Vérifier quota (count visuels)
  const quotaOk = await checkAndConsumeQuota('visuals', count);
  if (!quotaOk) return;
  
  // 2. Appeler create-job-set
  const { data, error } = await supabase.functions.invoke('create-job-set', {
    body: { brandId: activeBrandId, prompt, count, aspectRatio }
  });
  
  // 3. Gérer le résultat
  if (error) {
    await refundVisuals(count);
    showError(error);
    return;
  }
  
  // 4. Tracker le job set
  const jobSetId = data.data.id;
  setActiveJobSetId(jobSetId);
  setCarouselTotal(count);
  
  // 5. Déclencher le worker
  await triggerWorker();
  
  // 6. Afficher le suivi en temps réel
  addMessage({
    role: 'assistant',
    content: `Génération de ${count} slides en cours...`,
    type: 'carousel',
    metadata: { jobSetId, total: count }
  });
};
```

### 3. **Détection d'Intention Simplifiée**

```typescript
const detectIntent = (prompt: string): 'image' | 'video' | 'carousel' | 'unknown' => {
  const lower = prompt.toLowerCase();
  
  if (/(carrousel|carousel|slides|série)/i.test(lower)) {
    return 'carousel';
  }
  
  if (/(vidéo|video|reel|short|story)/i.test(lower)) {
    return 'video';
  }
  
  if (/(image|visuel|photo|illustration)/i.test(lower)) {
    return 'image';
  }
  
  return 'unknown';
};
```

### 4. **Gestion des Quotas Centralisée**

```typescript
const checkAndConsumeQuota = async (type: 'woofs' | 'visuals', amount: number): Promise<boolean> => {
  try {
    // 1. Vérifier le quota
    const { data: quota } = await supabase.functions.invoke('get-quota', {
      body: { brand_id: activeBrandId }
    });
    
    const remaining = type === 'woofs' ? quota.woofs_remaining : quota.visuals_remaining;
    
    if (remaining < amount) {
      toast.error(`Quota insuffisant. Il te reste ${remaining} ${type}.`);
      return false;
    }
    
    // 2. Consommer le quota
    const endpoint = type === 'woofs' ? 'alfie-consume-woofs' : 'alfie-consume-visuals';
    const { error } = await supabase.functions.invoke(endpoint, {
      body: { 
        [type === 'woofs' ? 'cost_woofs' : 'cost_visuals']: amount,
        brand_id: activeBrandId 
      }
    });
    
    if (error) {
      toast.error('Impossible de consommer le quota');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Quota check error:', error);
    return false;
  }
};

const refundWoofs = async (amount: number) => {
  await supabase.functions.invoke('alfie-refund-woofs', {
    body: { amount, brand_id: activeBrandId }
  });
};
```

---

## 🎨 Interface Utilisateur

### 1. **Messages**
- Bulles de chat avec avatars (déjà implémenté)
- Types de messages :
  - **Texte** : Bulle standard
  - **Image** : Aperçu + boutons d'action
  - **Vidéo** : Player + métadonnées
  - **Carrousel** : Grille de slides avec progression

### 2. **Composer**
- Textarea moderne (déjà implémenté)
- Boutons :
  - Upload image
  - Send
- Quick chips :
  - "Image 1:1"
  - "Vidéo 9:16"
  - "Carrousel 5 slides"

### 3. **Barre de Quotas**
- Badges avec barres de progression (déjà implémenté)
- Affichage en temps réel

---

## 🔄 Flux Utilisateur

### Scénario 1 : Génération d'Image

1. User : "Crée-moi une image d'un coucher de soleil"
2. Système : Détecte intent = 'image'
3. Système : Vérifie quota (1 Woof)
4. Système : Appelle `alfie-render-image`
5. Système : Affiche l'image générée
6. User : Peut télécharger, régénérer, ou améliorer

### Scénario 2 : Génération de Vidéo

1. User : "Fais-moi une vidéo de 10s sur le marketing"
2. Système : Détecte intent = 'video'
3. Système : Vérifie quota (2 Woofs)
4. Système : Appelle `generate-video`
5. Système : Affiche placeholder avec progression
6. Système : Polling du statut
7. Système : Affiche la vidéo terminée

### Scénario 3 : Génération de Carrousel

1. User : "Crée un carrousel de 5 slides sur le SEO"
2. Système : Détecte intent = 'carousel'
3. Système : Vérifie quota (5 Visuels)
4. Système : Appelle `create-job-set`
5. Système : Déclenche `process-job-worker`
6. Système : Affiche progression en temps réel
7. Système : Affiche les 5 slides terminées

---

## 🚫 Ce Qui Est SUPPRIMÉ

- ❌ `alfie-chat` (agent IA complexe)
- ❌ `alfie-plan-carousel` (planification manuelle)
- ❌ `alfie-classify-intent` (classification IA)
- ❌ Validation slide-by-slide
- ❌ Édition de plan
- ❌ Templates Canva
- ❌ Amélioration d'image
- ❌ Toute logique de conversation complexe

---

## ✅ Ce Qui Est CONSERVÉ

- ✅ Gestion des quotas (Woofs/Visuels)
- ✅ Génération d'images (`alfie-render-image`)
- ✅ Génération de vidéos (`generate-video`)
- ✅ Génération de carrousels (`create-job-set`)
- ✅ Worker de traitement (`process-job-worker`)
- ✅ UI moderne (bulles, quotas, composer)
- ✅ Upload d'image de référence
- ✅ Historique des messages

---

## 📊 Avantages de Cette Architecture

1. **Simplicité** : Moins de 500 lignes de code
2. **Maintenabilité** : Logique claire et séparée
3. **Performance** : Pas d'appels IA inutiles
4. **Robustesse** : Gestion d'erreurs centralisée
5. **Évolutivité** : Facile d'ajouter de nouveaux types

---

## 🛠️ Prochaines Étapes

1. ✅ Créer le nouveau composant `AlfieChat.tsx`
2. ✅ Implémenter les 3 fonctions de génération
3. ✅ Tester chaque flux
4. ✅ Déployer et monitorer

---

**Date de création :** 2025-01-XX  
**Auteur :** Manus AI Agent  
**Version :** 2.0 (Simplifié)
