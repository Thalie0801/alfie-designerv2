# Alfie Designer — Cahier des charges Refonte 2024

## 1. Contexte & objectifs

Alfie Designer devient un agent conversationnel à invite unique qui fabrique, à la demande, des **Images**, **Carrousels** et **Reels/Vidéos courtes**. Chaque production peut soit exploiter un template Canva (Brand Kit appliqué), soit être générée/retouchée via IA (Nano-Banana pour l'image, pipelines vidéo éco), puis livrée en **PULL** : lien Canva + pack prêt à poster. Aucune publication automatique n'est envisagée.

**Objectifs de la refonte :**

- Simplifier l'expérience : « Fais-moi un [format] pour [objectif] » → 2–3 questions → livrable.
- Maîtriser le coût : par défaut, routage Image→Vidéo et Éco T2V (0 Woof). Premium (Veo/Sora) uniquement sur confirmation explicite.
- Clarifier les offres sans modifier les prix : Starter 39 € · Pro 99 € · Studio 199 €.
- Préparer une passerelle douce vers Æditus (orchestration & publication) sans l'inclure dans le scope immédiat.

## 2. Périmètre (in scope)

- **Formats pris en charge :** Image (post/cover), Carrousel IG/LinkedIn, Reel / vidéo courte 9:16 (8–15 s).
- **Entrées :** invite texte (option vocal), Brand Kit, médias fournis (1–5 images), choix Template Canva ou IA.
- **Sorties :** lien « Ouvrir dans Canva » (pull) + ZIP (PNG/PDF | MP4+SRT+cover).
- **Moteurs :** Nano-Banana (image, upscales, i2i), Éco T2V (texte→vidéo léger), Image→Vidéo (Ken Burns/Parallax/Montage), Premium T2V (Veo/Sora) optionnel.

## 3. Hors périmètre (out of scope)

- Publication/planification sociale automatique (toutes plateformes).
- Push automatique vers Canva (bloqué tant que l'API ne le permet pas).
- Vidéo > 60 s, 4K ou effets lourds type VFX ciné continu.
- Analytics avancés (reporting externe) — à cadrer en V2.

## 4. Glossaire

- **Pull :** import manuel par le client (ouvrir le modèle Canva, importer le ZIP).
- **Push :** dépôt automatique dans Canva (non garanti, hors V1).
- **Woof :** crédit Premium consommé par plans Veo/Sora.
- **Éco T2V :** génération vidéo légère, 0 Woof, 8–12 s, social-ready.
- **Image→Vidéo :** animation à partir d’1–5 images (Ken Burns, Parallax, Montage), 0 Woof.

## 5. Offres & quotas (prix inchangés)

**Règle générale :** 1 plan = 1 marque. Stockage 30 jours. Téléchargements illimités.

| Plan    | Prix | Images/mois | Reels/mois (0 Woof) | Woofs Premium inclus | Notes |
|---------|------|-------------|---------------------|----------------------|-------|
| Starter | 39 € | 150         | 15                  | 0                    | Brand Kit appliqué, 1 version par demande |
| Pro     | 99 € | 450         | 45                  | 5                    | Choix A/B utile, déclinaisons pertinentes |
| Studio  |199 € | 1000        | 100                 | 15                   | Packs multi-canaux, composants de marque |

**Add-ons :** Marque supplémentaire +39 €/mois · Packs Woofs (+5/+10) · Stockage 90 j +9 €/marque.

**Règles de comptage :**

- **Images :** toute image IA générée/retouchée (Nano-Banana) = 1. Utiliser un template Canva sans image IA = 0.
- **Carrousel :** chaque illustration IA intégrée compte dans Images ; les slides purement typographiques ne comptent pas.
- **Reel :** chaque export vidéo = 1 dans le quota Reels. 0 Woof si Image→Vidéo ou Éco T2V. Woofs uniquement si plan Premium validé.

## 6. Parcours utilisateur (commun)

1. **Invite :** « Fais-moi un [Image | Carrousel | Reel 9:16] pour [objectif] ».
2. **Questions ciblées (2–3) :** Style (Template Canva ou IA), médias à importer (0–5 images), ton/CTA.
3. **Routage :**
   - Template Canva trouvé → remplissage + Brand Kit + animations légères (si demandé).
   - IA (Nano-Banana) → génération/retouche images → mise en page.
   - Vidéo → Image→Vidéo ou Éco T2V par défaut ; Premium T2V sur validation explicite.
4. **Prévisualisation :** aperçu, légende/alt-text proposés, SRT si vidéo.
5. **Livraison (PULL) :** bouton Ouvrir dans Canva + téléchargement ZIP. Nommage standardisé.
6. **Compteurs :** images, reels, woofs visibles ; alerte à 80 %.

## 7. Détails par format

### 7.1 Image (post/cover)

- **Entrées :** sujet, ton, format (1:1 ou 4:5), assets (optionnels).
- **Sorties :** PNG (≥1080), SVG source, légende, alt-text.
- **Qualité :** contraste AA, hiérarchie typographique, marges de sécurité.

### 7.2 Carrousel (IG/LinkedIn)

- **Structure :** cover → 4–5 slides cœur → récap/CTA.
- **Sorties :** PNG par slide (1080×1350), PDF du lot, SVG par slide, légende + alt-texts.
- **Variantes (Pro/Studio) :** mise en page A/B ; post résumé 1:1 (Pro) ; pack LinkedIn PDF + Pinterest 2:3 (Studio).

### 7.3 Reel / Vidéo courte (9:16)

- **Par défaut (0 Woof) :**
  - Image→Vidéo : Ken Burns, Parallax (2.5D en Studio), Montage d’1–5 images.
  - Éco T2V : 8–12 s, 720–1080p, sous-titres, cover.
- **Premium (Woofs) :** ajout d’1–2 plans « héros » Veo/Sora sur confirmation (modale coût).
- **Sorties :** MP4 + SRT + cover.
- **Qualité :** hook 0–2 s, 5–7 beats, sous-titres ≤2 lignes, −14 LUFS, safe-zones 9:16.

## 8. Intégrations & livraisons

- **Canva (PULL) :** lien « Utiliser ce modèle » ou import de médias/maquettes. Aucune promesse de push ni de publication.
- **Nano-Banana :** génération/retouche images, seeds/StyleDNA, upscale ×4, i2i.
- **Fichiers :** ZIP structuré / dossiers normalisés : `YYYY-MM/Marque/Format_Titre/...`.

## 9. Règles de qualité & accessibilité

- **Texte :** 38–55 caractères/ligne, contraste AA, hiérarchie H1/H2/captions.
- **Images :** pas d’artefacts majeurs, alignement au Brand Kit, alt-texts fournis.
- **Vidéo :** lisibilité sous-titres, pas de « flash » excessif, audio cohérent.
- **Contrôles :** checklists automatiques avant livraison.

## 10. Conformité & droits

- L’utilisateur garantit les droits sur les médias importés.
- Pas d’usage de logos/likeness tiers sans droits.
- Pas de génération de personnes réelles sans consentement.

## 11. Stockage & rétention

- Conservation des rendus 30 jours.
- Add-on : extension 90 jours.
- Export ZIP 1-clic avant purge.

## 12. KPI & pilotage

- Délai de 1er aperçu : < 2 min pour Image/Carrousel ; < 5 min pour Reel Éco.
- Taux d’acceptation v1 : ≥ 70 % Starter, ≥ 80 % Pro/Studio.
- Part de vidéos 0 Woof : ≥ 85 %.
- Taux de recours Premium : < 15 %.

## 13. Roadmap (post-refonte)

- Push Canva (si API) en add-on, non contractuel.
- Analytics créatifs (V2) : variété/novelty, couverture thématique.
- Voix off TTS (option), export Lottie, packs formats supplémentaires.
