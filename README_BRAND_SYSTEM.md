# Système de Marques et Quotas

## Vue d'ensemble

Le système de quotas d'Alfie fonctionne **par marque**, pas par utilisateur. Chaque marque dispose de ses propres quotas mensuels (visuels, vidéos, Woofs) qui ne sont pas mutualisés.

## Modèle de tarification

### 1 Plan = 1 Marque

- **Starter** (39€/mois) : 150 visuels + 15 vidéos + 15 Woofs
- **Pro** (99€/mois) : 450 visuels + 45 vidéos + 45 Woofs
- **Studio** (199€/mois) : 1000 visuels + 100 vidéos + 100 Woofs

### Add-on "Marque +"

Pour ajouter une marque supplémentaire : **+39€/mois**
- Créée avec des quotas **Starter** par défaut
- Possibilité d'upgrade individuel vers Pro ou Studio

### Upgrades

Chaque marque peut être upgradée individuellement :
- **Starter → Pro** : +60€/mois (différentiel)
- **Starter → Studio** : +160€/mois (différentiel)
- **Pro → Studio** : +100€/mois (différentiel)

*Facturation au prorata du cycle en cours*

### Packs Woofs

Pour augmenter temporairement le quota de Woofs :
- **Pack +50 Woofs**
- **Pack +100 Woofs**

## Règles de gestion

### Quotas

- **Visuels IA** (Nano/Banana) : comptés dans le quota `images`
- **Vidéos IA** : comptées dans `videos` + consomment des `woofs`
  - Sora : 1 Woof
  - Veo 3 : 4 Woofs
- **Confection Canva** (adaptation template) : **GRATUITE** (jamais comptée)

### Alertes et Limites

- **Alerte à 80%** : notification + proposition Pack Woofs ou Upgrade
- **Hard-stop à 110%** : blocage avec CTA d'action (Pack ou Upgrade)

### Reset mensuel

- Les quotas se réinitialisent le **1er de chaque mois**
- Pas de report des quotas non utilisés
- Date de reset affichée dans l'UI

### Rétention des assets

- **30 jours** de disponibilité après génération
- Purge automatique après expiration
- Export recommandé avant purge

## Structure de données

### Table `brands`

```sql
id: uuid
user_id: uuid
name: text
plan: enum(starter, pro, studio)
is_addon: boolean  -- true si créée via "Marque +"

-- Quotas
quota_images: int
quota_videos: int
quota_woofs: int

-- Consommation
images_used: int
videos_used: int
woofs_used: int

-- Reset
resets_on: date  -- 1er du mois suivant

-- Stripe
stripe_subscription_id: text

-- Brand Kit
palette: jsonb
logo_url: text
fonts: jsonb
voice: text
canva_connected: boolean
```

## Configuration système

Voir `src/config/systemConfig.ts` pour tous les paramètres configurables :
- Prix par tier
- Différentiels d'upgrade
- Quotas par tier
- Facteurs Woofs (Veo3/Sora)
- Seuils d'alerte
- Rétention assets

## Composants UI

### Gestion des marques

- **`<BrandManager />`** : Affiche et sélectionne les marques
- **`<BrandQuotaDisplay />`** : Compteurs et barres de progression
- **`<AddBrandDialog />`** : Créer une marque add-on (+39€/mois)
- **`<BrandUpgradeDialog />`** : Upgrader une marque vers un tier supérieur
- **`<WoofsPackDialog />`** : Ajouter un Pack Woofs (+50/+100)

### Hooks

- **`useBrandKit()`** : Gestion des marques (liste, active, sélection)
- **`useBrandManagement()`** : Actions (create, upgrade, add woofs)
- **`useStripeCheckout()`** : Checkout Stripe pour paiements

## Workflow utilisateur

### 1. Création d'une marque

```typescript
const { createAddonBrand } = useBrandManagement();

await createAddonBrand({
  name: "Ma Nouvelle Marque",
  palette: ["#FF5733", "#33FF57"],
  voice: "Professionnel et inspirant"
});
// → Créée avec quotas Starter (150/15/15)
```

### 2. Upgrade d'une marque

```typescript
const { upgradeBrand } = useBrandManagement();

await upgradeBrand(brandId, 'pro');
// → Passe les quotas à Pro (450/45/45)
// → Facturation du différentiel (+60€)
```

### 3. Ajout de Pack Woofs

```typescript
const { addWoofsPack } = useBrandManagement();

await addWoofsPack(brandId, 100);
// → +100 Woofs pour cette marque
```

### 4. Consommation de quotas

```typescript
import { consumeQuota, canGenerateVideo } from '@/utils/quotaManager';

// Avant génération
const { canGenerate, reason } = await canGenerateVideo(brandId, 4); // Veo3
if (!canGenerate) {
  toast.error(reason);
  return;
}

// Après génération réussie
await consumeQuota(brandId, 'video', 4); // +1 vidéo, +4 Woofs
```

## Logs et conformité

Toutes les générations sont loggées dans `generation_logs` :
- Type (visual/video)
- Engine (nano/banana/sora/veo3)
- Coût Woofs
- Prompt (tronqué à 100 caractères, RGPD)
- Durée, statut, erreurs

**Rétention** : 30 jours (purge automatique)

## Edge Functions

### Automatisées (Cron)

- **`purge-expired-assets`** : Quotidien (2h00) - Purge assets expirés
- **`reset-monthly-quotas`** : Mensuel (1er, 1h00) - Reset compteurs

### À implémenter (Stripe)

- **`create-brand-addon`** : Créer une marque add-on via Stripe
- **`upgrade-brand`** : Upgrade avec proration
- **`purchase-woofs-pack`** : Achat Pack Woofs

## Intégration Stripe

### Produits nécessaires

1. **Marque Starter** (39€/mois, récurrent)
2. **Marque Pro** (99€/mois, récurrent)
3. **Marque Studio** (199€/mois, récurrent)
4. **Add-on Marque +** (39€/mois, récurrent, add-on)
5. **Pack Woofs +50** (prix à définir, one-time)
6. **Pack Woofs +100** (prix à définir, one-time)

### Metadata Stripe

```javascript
{
  brand_id: "uuid",
  brand_name: "Ma Marque",
  tier: "starter|pro|studio",
  is_addon: "true|false"
}
```

## Points d'attention

1. **Pas de mutualisation** : Chaque marque = quotas indépendants
2. **Confection Canva gratuite** : Ne JAMAIS consommer de quotas
3. **Hard-stop à 110%** : Bloquer avec UX claire + CTA
4. **Export assets** : Rappeler avant purge (30j)
5. **Logs RGPD** : Prompts tronqués (100 car max)
