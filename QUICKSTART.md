# 🚀 Alfie Designer - Quick Start Guide

## ⚡ Démarrage rapide (5 minutes)

### 1. Prérequis
```bash
# Vérifier Node.js
node --version  # 18+ requis

# Vérifier PostgreSQL
psql --version  # 14+ requis
```

### 2. Installation
```bash
cd /home/code/alfie-designer
bun install  # ou npm install
```

### 3. Base de données
```bash
# La DB est déjà créée et seedée !
psql -h localhost -U $PGUSER -d alfie_designer -c "SELECT name, price_monthly FROM plans;"
```

Résultat attendu :
```
    name    | price_monthly 
------------+---------------
 Starter    |         39.00
 Pro        |         99.00
 Studio     |        199.00
 Enterprise |              
```

### 4. Variables d'environnement
Le fichier `.env.local` est déjà configuré avec :
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Lancer l'app
```bash
bun run dev
```

✅ Ouvrir http://localhost:3000

---

## 🎯 Tester l'application

### Test 1 : Landing page
1. Ouvrir http://localhost:3000
2. Vérifier le pricing (39€, 99€, 199€)
3. Cliquer sur le toggle "Annuel" → prix changent (-20%)

### Test 2 : Inscription
1. Cliquer "Commencer"
2. Email : `demo@test.com`
3. Password : `password123`
4. Cliquer "Créer mon compte"
5. ✅ Redirection vers /chat

### Test 3 : Chat Alfie
1. Cliquer sur "📱 Post Instagram"
2. Taper : "Crée un post moderne"
3. Envoyer
4. ✅ Alfie répond (placeholder)

### Test 4 : Projets
1. Cliquer "Mes projets" dans la sidebar
2. ✅ Voir 3 projets exemples
3. Tester les filtres (Image, Carrousel, Vidéo)

### Test 5 : Affiliation
1. Cliquer "Programme Partenaire" dans la sidebar
2. ✅ Voir le lien de parrainage
3. ✅ Voir les stats (0 pour l'instant)

---

## 🔧 Commandes utiles

### Développement
```bash
bun run dev          # Lancer le serveur (port 3000)
bun run build        # Build production
bun run start        # Lancer en production
bun run lint         # Linter
```

### Base de données
```bash
# Se connecter à la DB
psql -h localhost -U $PGUSER -d alfie_designer

# Voir les tables
\dt

# Voir les utilisateurs
SELECT id, email, referral_code FROM users;

# Voir les plans
SELECT * FROM plans;

# Reset la DB (attention !)
psql -h localhost -U $PGUSER -d alfie_designer -f lib/db/schema.sql
psql -h localhost -U $PGUSER -d alfie_designer -f lib/db/seed.sql
```

### Logs
```bash
# Voir les logs du serveur
tail -f server.log

# Voir les logs PostgreSQL
tail -f /var/log/postgresql/postgresql-*.log
```

---

## 📁 Fichiers importants

### Configuration
- `.env.local` - Variables d'environnement
- `next.config.ts` - Config Next.js
- `tailwind.config.ts` - Config Tailwind
- `components.json` - Config shadcn/ui

### Pages principales
- `app/page.tsx` - Landing page
- `app/chat/page.tsx` - Interface Alfie
- `app/projects/page.tsx` - Bibliothèque
- `app/affiliate/page.tsx` - Dashboard affilié

### APIs
- `app/api/auth/register/route.ts` - Inscription
- `app/api/auth/login/route.ts` - Connexion
- `app/api/plans/route.ts` - Liste des plans
- `app/api/generate/route.ts` - Génération (placeholder)

### Business logic
- `lib/db/index.ts` - Pool PostgreSQL
- `lib/auth/jwt.ts` - JWT tokens
- `lib/auth/password.ts` - Hash passwords
- `lib/ai/generators.ts` - Placeholders IA

---

## 🐛 Troubleshooting

### Erreur : "Cannot connect to database"
```bash
# Vérifier que PostgreSQL tourne
sudo systemctl status postgresql

# Vérifier les credentials
echo $PGUSER
echo $PGPASSWORD

# Tester la connexion
psql -h localhost -U $PGUSER -d alfie_designer -c "SELECT 1;"
```

### Erreur : "Port 3000 already in use"
```bash
# Trouver le process
lsof -i :3000

# Tuer le process
kill -9 <PID>

# Ou utiliser un autre port
PORT=3001 bun run dev
```

### Erreur : "Module not found"
```bash
# Réinstaller les dépendances
rm -rf node_modules
rm bun.lockb  # ou package-lock.json
bun install
```

### Page blanche / erreur 500
```bash
# Vérifier les logs
tail -f server.log

# Vérifier la console navigateur (F12)

# Rebuild
bun run build
bun run dev
```

---

## 🎨 Personnalisation

### Changer les couleurs
Éditer `app/globals.css` :
```css
:root {
  --primary: 262.1 83.3% 57.8%;  /* Violet */
  --secondary: 220 14.3% 95.9%;  /* Gris clair */
}
```

### Ajouter un composant shadcn/ui
```bash
bunx shadcn@latest add <component-name>

# Exemples :
bunx shadcn@latest add alert
bunx shadcn@latest add toast
bunx shadcn@latest add data-table
```

### Modifier le logo
Remplacer dans `app/page.tsx` :
```tsx
<Sparkles className="h-8 w-8" />
```

---

## 📚 Documentation complète

- **README.md** - Vue d'ensemble
- **PROJECT_OVERVIEW.md** - Documentation technique complète
- **DEPLOYMENT.md** - Guide de déploiement
- **SUMMARY.md** - Résumé du projet

---

## 🚀 Next Steps

### Pour tester en production
1. **Brancher un provider IA** (DALL·E, Flux...)
   - Éditer `lib/ai/generators.ts`
   - Ajouter la clé API dans `.env.local`

2. **Configurer Stripe**
   - Créer compte sur stripe.com
   - Créer les produits/prix
   - Ajouter les clés dans `.env.local`

3. **Déployer**
   - Push sur GitHub
   - Connecter à Vercel
   - Configurer la DB sur Neon.tech

### Pour développer
1. **Ajouter des features**
   - Upload de logo (Brand Kit)
   - Éditeur de templates
   - Bulk generation

2. **Améliorer l'UX**
   - Animations (Framer Motion)
   - Skeleton loaders
   - Toast notifications

3. **Optimiser**
   - Image optimization (next/image)
   - Code splitting
   - Caching (Redis)

---

## 💡 Tips

### Développement rapide
```bash
# Utiliser Turbopack (plus rapide)
bun run dev --turbo

# Auto-format au save (VSCode)
# Installer l'extension Prettier
```

### Debug
```bash
# Activer les logs détaillés
DEBUG=* bun run dev

# Voir les requêtes SQL
# Ajouter dans lib/db/index.ts :
console.log(query, params);
```

### Performance
```bash
# Analyser le bundle
bunx @next/bundle-analyzer

# Lighthouse audit
# Ouvrir DevTools → Lighthouse → Generate report
```

---

## 🎉 C'est parti !

Ton prototype MVP est **100% fonctionnel** et prêt à être testé.

**Questions ?** Consulte PROJECT_OVERVIEW.md ou DEPLOYMENT.md

**Bon développement ! 🚀**
