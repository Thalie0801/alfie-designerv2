# 🎨 Alfie Designer - AI Design Assistant

![Alfie Designer](https://img.shields.io/badge/Next.js-15.5.3-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?style=for-the-badge&logo=tailwind-css)

**Alfie Designer** est une plateforme d'assistant créatif IA qui transforme tes idées en designs professionnels pour Instagram, TikTok, LinkedIn et plus encore.

## ✨ Fonctionnalités

### 🎯 Core Features
- **Chat IA Créatif** - Dialogue naturel avec Alfie pour créer des visuels
- **Upload d'images** - Ajoute tes propres images dans le chat
- **Téléchargement** - Download tes créations en HD/4K
- **Sidebar Navigation** - Navigation fluide et responsive

### 📊 Dashboard & Analytics
- **Quota System** - Suivi de l'utilisation mensuelle (images/vidéos)
- **Progress Bars** - Visualisation des limites par plan
- **Statistiques** - Vues, téléchargements, conversions

### 💰 Programme d'Affiliation
- **3 niveaux de commissions** - 15% / 5% / 2%
- **Système de payout** - Demande de paiement (minimum 50€)
- **Historique des paiements** - Suivi complet des versements
- **Lien de parrainage** - Partage et tracking

### 🎨 Design System
- **Couleurs pastel mixtes** - Rose clair, bleu clair, vert clair
- **Gradients harmonieux** - Design moderne et apaisant
- **Cards colorées** - Chaque section a sa propre couleur
- **Responsive** - Mobile-first design

## 🚀 Installation

```bash
# Clone le repo
git clone https://github.com/Thalie0801/Alfie-designer-2.git
cd Alfie-designer-2

# Installe les dépendances
bun install

# Lance le serveur de développement
bun run dev
```

Ouvre [http://localhost:3000](http://localhost:3000) dans ton navigateur.

## 📦 Stack Technique

- **Framework** - Next.js 14 (App Router)
- **Language** - TypeScript
- **Styling** - Tailwind CSS + shadcn/ui
- **Icons** - Lucide React
- **Package Manager** - Bun

## 🎨 Palette de Couleurs

```css
/* Rose clair */
--primary: 340 82% 67%;

/* Bleu clair */
--accent: 200 95% 65%;

/* Vert clair */
--success: 142 76% 73%;

/* Violet */
--chart-4: 280 65% 60%;
```

## 📁 Structure du Projet

```
alfie-designer/
├── app/
│   ├── page.tsx              # Landing page
│   ├── chat/page.tsx         # Chat IA
│   ├── dashboard/page.tsx    # Dashboard avec quotas
│   ├── affiliate/page.tsx    # Programme d'affiliation + payout
│   ├── profile/page.tsx      # Profil utilisateur
│   ├── projects/page.tsx     # Bibliothèque de projets
│   └── favorites/page.tsx    # Favoris
├── components/
│   ├── sidebar.tsx           # Navigation sidebar
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── auth/                 # JWT & password hashing
│   ├── db/                   # Database schema & seed
│   └── ai/                   # AI generators
└── public/
    └── alfie-avatar.png      # Avatar Alfie
```

## 💳 Plans Tarifaires

| Plan | Prix | Images/mois | Vidéos/mois |
|------|------|-------------|-------------|
| **Starter** | 39€ | 150 | 15 |
| **Pro** | 99€ | 450 | 45 |
| **Business** | 199€ | 1500 | 150 |
| **Enterprise** | Custom | ∞ | ∞ |

## 🤝 Programme d'Affiliation

- **Niveau 1** - 15% de commission sur tes filleuls directs
- **Niveau 2** - 5% sur le réseau de ton réseau
- **Niveau 3** - 2% sur le réseau étendu
- **Payout minimum** - 50€
- **Délai de paiement** - 5-7 jours ouvrés

## 🔐 Authentification

Compte de test :
- **Email** : test@alfie-designer.com
- **Password** : testpassword123

## 📝 License

© 2025 Alfie Designer. Tous droits réservés.

## 👥 Auteur

Créé avec ❤️ par [Thalie0801](https://github.com/Thalie0801)

---

**Live Demo** : [https://late-pans-crash.lindy.site](https://late-pans-crash.lindy.site)
