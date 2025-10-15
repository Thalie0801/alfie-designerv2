# 🚀 Alfie Designer - Déploiement & Next Steps

## ✅ Ce qui est fait

### Architecture complète
- **Frontend** : Next.js 14 + React + Tailwind + shadcn/ui
- **Backend** : Node.js/TypeScript avec API routes
- **Database** : PostgreSQL avec schéma complet (17 tables)
- **Auth** : JWT + bcrypt (email/password)
- **Styling** : Design system moderne (Apple/Mercury inspired)

### Pages fonctionnelles
1. ✅ **Landing page** avec pricing exact (39€, 99€, 199€, Enterprise)
2. ✅ **Toggle mensuel/annuel** avec calcul automatique (-20%)
3. ✅ **Register/Login** avec validation et JWT
4. ✅ **Chat Alfie** avec interface conversationnelle
5. ✅ **Projets** avec filtres et recherche
6. ✅ **Dashboard affilié** avec tracking 3 niveaux (15%, 5%, 2%)

### APIs implémentées
- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/plans` - Liste des plans
- `POST /api/generate` - Génération (placeholder)
- `POST /api/canva/export` - Export Canva (stub)

### Base de données
```sql
✅ users (avec referral_code)
✅ brand_kits
✅ plans (seedé avec tarifs exacts)
✅ subscriptions
✅ usage (tracking crédits)
✅ projects
✅ assets
✅ prompts
✅ affiliates (3 niveaux)
✅ referral_clicks
✅ conversions
✅ payouts
```

## 🔜 À faire pour la production

### 1. Providers IA (priorité haute)
Remplacer les placeholders dans `lib/ai/generators.ts` :

**Images** :
```typescript
// Option 1: OpenAI DALL·E
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const response = await openai.images.generate({
  model: "dall-e-3",
  prompt: options.prompt,
  size: "1024x1024",
});

// Option 2: Replicate (Flux, SDXL)
import Replicate from 'replicate';
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const output = await replicate.run("black-forest-labs/flux-schnell", {
  input: { prompt: options.prompt }
});
```

**Vidéos** :
```typescript
// Runway Gen-3
// Pika API
// Luma Dream Machine
```

### 2. Stripe (priorité haute)
```bash
# 1. Créer compte Stripe
# 2. Récupérer les clés API
# 3. Créer les produits/prix dans Stripe Dashboard
# 4. Configurer webhooks

# Dans .env.local :
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Implémenter :
- `app/api/stripe/checkout/route.ts` - Créer session checkout
- `app/api/stripe/webhook/route.ts` - Gérer événements
- `app/api/stripe/portal/route.ts` - Customer portal

### 3. Canva Integration
```typescript
// lib/canva/client.ts
// 1. S'inscrire sur https://www.canva.dev/
// 2. Créer une app
// 3. Obtenir client_id + client_secret
// 4. Implémenter OAuth flow
// 5. Utiliser Connect API pour créer designs

// Activer dans .env.local :
FEATURE_CANVA_INTEGRATION=true
CANVA_CLIENT_ID=...
CANVA_CLIENT_SECRET=...
```

### 4. Redis + BullMQ (file d'attente)
```bash
# Pour gérer les générations longues
bun add bullmq ioredis

# Créer workers :
# - lib/workers/image-generator.ts
# - lib/workers/video-generator.ts
```

### 5. Storage (S3/R2)
```bash
# Pour stocker les assets générés
bun add @aws-sdk/client-s3

# Configurer :
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=alfie-assets
AWS_REGION=eu-west-1
```

### 6. Email (Resend/SendGrid)
```bash
bun add resend

# Pour :
# - Confirmation d'inscription
# - Reset password
# - Notifications affiliés
# - Factures
```

### 7. Analytics
```bash
# Posthog, Mixpanel, ou Amplitude
bun add posthog-js

# Tracker :
# - Inscriptions
# - Générations
# - Conversions affiliés
```

### 8. Monitoring
```bash
# Sentry pour les erreurs
bun add @sentry/nextjs

# Vercel Analytics (si déployé sur Vercel)
```

## 📦 Déploiement

### Option 1 : Vercel + Neon (recommandé)
```bash
# 1. Push sur GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/ton-username/alfie-designer.git
git push -u origin main

# 2. Créer DB sur Neon.tech
# 3. Importer schema.sql
# 4. Déployer sur Vercel
vercel --prod

# 5. Configurer variables d'environnement dans Vercel Dashboard
```

### Option 2 : Railway
```bash
railway login
railway init
railway up
```

### Option 3 : Docker + VPS
```dockerfile
# Dockerfile déjà prêt si besoin
```

## 🧪 Tests

```bash
# Installer Playwright
bun add -D @playwright/test

# Créer tests E2E :
# tests/auth.spec.ts
# tests/chat.spec.ts
# tests/pricing.spec.ts
# tests/affiliate.spec.ts

# Lancer tests
bun playwright test
```

## 🔒 Sécurité Production

- [ ] Changer JWT_SECRET (générer avec `openssl rand -base64 32`)
- [ ] Activer HTTPS only
- [ ] Configurer CORS
- [ ] Rate limiting (express-rate-limit)
- [ ] Helmet.js pour headers sécurité
- [ ] Validation stricte des uploads
- [ ] Sanitization des prompts IA
- [ ] GDPR : cookie consent, data export, right to deletion

## 📊 Métriques à suivre

- Inscriptions / jour
- Générations / utilisateur
- Taux de conversion (free → paid)
- Churn rate
- MRR (Monthly Recurring Revenue)
- Commissions affiliés versées
- Temps moyen de génération

## 💰 Coûts estimés (MVP)

- Vercel Pro : 20$/mois
- Neon Postgres : 19$/mois (Scale plan)
- Redis (Upstash) : 10$/mois
- OpenAI API : ~0.04$/image (DALL·E 3)
- Stripe : 1.4% + 0.25€ par transaction
- Domaine : 12€/an

**Total : ~50-70€/mois + coûts variables IA**

## 🎯 Roadmap

### Phase 1 (MVP - 2 semaines)
- [x] Landing + pricing
- [x] Auth + chat
- [x] Affiliation
- [ ] Stripe checkout
- [ ] Provider IA (1 seul pour commencer)

### Phase 2 (Beta - 1 mois)
- [ ] Canva export
- [ ] Brand Kit upload
- [ ] Email notifications
- [ ] Analytics basiques

### Phase 3 (V1 - 2 mois)
- [ ] Multi-providers IA
- [ ] Bulk generation
- [ ] Templates library
- [ ] Mobile app (React Native)

## 📞 Support

Questions ? Consulte :
- [Next.js Docs](https://nextjs.org/docs)
- [Stripe Docs](https://stripe.com/docs)
- [Canva Dev Portal](https://www.canva.dev/)

---

**Prototype prêt à déployer ! 🎉**
