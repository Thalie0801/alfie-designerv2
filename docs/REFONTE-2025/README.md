# Refonte Alfie Designer — v1.0
_Date: 2025-10-12 (Europe/Paris)_

## Objectifs
- Agent à **invite unique** qui fabrique à la demande : **Image**, **Carrousel IG/LinkedIn**, **Reel 9:16 (8–15s)**.
- Deux voies : **Template Canva** (Brand Kit appliqué) **ou** **IA** (Nano‑Banana / Éco T2V / Image→Vidéo).
- Livraison **PULL** : bouton **Ouvrir dans Canva** + **ZIP** (PNG/PDF | MP4+SRT+cover). _Pas de push, pas de publication auto._

## Deux modes d'interaction

Alfie Designer propose deux interfaces distinctes selon le niveau d'accompagnement souhaité :

### Chat Alfie (`/chat`) — Mode Exploration
- **Usage** : Conversations naturelles pour explorer les possibilités et affiner les idées
- **Public** : Nouveaux utilisateurs, phase d'idéation, besoin de guidance
- **Fonctionnalités** :
  - Questions ciblées par l'IA (2-3 max)
  - Suggestions de style et format
  - Génération progressive avec feedback
  - Aide à la décision (Template vs IA)
- **Limitations actuelles** :
  - Pas de scoring de cohérence Brand Kit
  - Pas de carrousels multi-visuels
  - Focus sur la génération unitaire

### Créateur (`/app`) — Mode Expert
- **Usage** : Génération directe avec contrôle total des paramètres
- **Public** : Utilisateurs confirmés, workflows répétitifs, batch production
- **Fonctionnalités** :
  - Formulaire structuré (format, objectif, médias)
  - Scoring de cohérence Brand Kit en temps réel
  - Support carrousels multi-visuels (jusqu'à 10 slides)
  - Upload de médias multiple (0-5)
  - Prévisualisation instantanée
- **Avantages** :
  - Génération plus rapide (moins d'étapes)
  - Paramètres pré-remplis si habitudes détectées
  - Accès direct aux options avancées

**Recommandation** : Commencer par Chat Alfie pour découvrir, puis migrer vers Créateur pour la production quotidienne.

## Offres & quotas (inchangés)
- Starter 39 € : **150 Images / 15 Reels / 0 Woof**
- Pro 99 € : **450 Images / 45 Reels / 5 Woofs**
- Studio 199 € : **1000 Images / 100 Reels / 15 Woofs**
Règles : **1 plan = 1 marque**, stockage 30 jours, téléchargements illimités. **Alerte quotas à 80 %.**

## Règles de comptage
- **Images** : toute image **IA** générée/retouchée (= 1). Utiliser un template **sans image IA** (= 0).
- **Carrousel** : chaque illustration **IA** compte dans **Images** ; slides purement typographiques (= 0).
- **Reel** : chaque **export** vidéo (= 1 Reel). **0 Woof** si _Image→Vidéo_ ou _Éco T2V_. **Woofs** uniquement si **Premium T2V (Veo/Sora)**.

## Parcours (commun aux deux modes)
1. Invite : "Fais‑moi un [Image | Carrousel | Reel 9:16] pour [objectif]".
2. Questions ciblées (2–3 en Chat, formulaire direct en Créateur) : Style (Template/IA), médias (0–5 images), ton/CTA.
3. Routage : Template Canva → remplissage + Brand Kit ; IA → génération/retouche → mise en page ; Vidéo → Image→Vidéo ou Éco T2V par défaut ; Premium T2V **sur confirmation**.
4. Prévisualisation : aperçu + légende/alt‑text + SRT (si vidéo).
5. Livraison (PULL) : **lien Canva** + **téléchargement ZIP** (naming standard).

## Qualité & accessibilité
- Contraste **AA**, hiérarchie typographique, marges de sécurité.
- Vidéo : hook 0–2 s, 5–7 beats, **sous‑titres ≤ 2 lignes**, **−14 LUFS**, safe‑zones 9:16.

## Conformité
- Pas d'autopublication, pas d'usage de logos/likeness tiers sans droits, pas de génération de personnes réelles sans consentement.

## Acceptation
- Chaque livrable contient **lien Canva fonctionnel** + **ZIP**.
- **Reels** par défaut **sans** Woof sauf confirmation Premium.
- **Compteurs** (images/reels/woofs) visibles + **alerte** à 80 %.

> Source: Cahier des charges — Refonte Alfie Designer (oct 2025). 
