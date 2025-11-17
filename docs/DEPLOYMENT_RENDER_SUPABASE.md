# Déploiement Render + Supabase

Ce guide décrit la checklist finale pour mettre en production l'application statique Vite sur Render et l'intégrer avec Supabase en toute sécurité.

## 1. Finaliser le static site Render (Vite SPA)

1. Rendez-vous dans l'interface Render → **Static Site** → *Redirects / Rewrites* et ajoutez la règle :
   - **Source** : `/*`
   - **Destination** : `/index.html`
   - **Type** : *Rewrite*
   
   Cette règle évite les erreurs `404` lors du rafraîchissement d'une route côté client.
2. (Optionnel mais recommandé) Ajoutez des en-têtes HTTP dans **Headers** :
   - `Cache-Control: public, max-age=300` sur `/*.js` et `/*.css`
   - `Cache-Control: no-store` sur `/index.html`
3. Copiez l'URL publique `*.onrender.com`. Elle sera utilisée dans la configuration Supabase.

## 2. Supabase – sécurité et authentification

Dans le projet Supabase associé :

- **Auth → Settings** : renseignez l'URL Render copiée ci-dessus (et les éventuels domaines customs) dans **Allowed Origins / Redirect URLs**.
- **Storage** : vérifiez que le bucket `chat-uploads` est privé et que les policies RLS appliquent bien `owner = auth.uid()`.
- **Edge Functions** : assurez-vous que les fonctions appellent Supabase avec la clé `service_role`. Les workers actuels le font déjà.

## 3. Variables d'environnement côté front

Les variables suivantes doivent être définies (déjà en place par défaut) :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Si vous changez de projet Supabase, pensez à mettre à jour ces valeurs.

## 4. Smoke tests (≈2 minutes)

Depuis l'URL Render :

1. **Chargement** : la SPA doit s'afficher, y compris lors d'un refresh sur une route interne.
2. **Authentification** : tester le login et le sign-up.
3. **Upload** : téléversez une image puis une vidéo. Vérifiez l'aperçu dans l'UI et la présence des objets dans Supabase Storage sous `userId/...`.
4. **Chat → Orchestrator** : envoyez un prompt vidéo « `9:16 • 12s …` ». Le flux doit passer par `awaiting_video_prompt` puis `generating`.
5. **Asset final** : le worker doit insérer un enregistrement `media_generations` (type `video`) avec `metadata.woofs = 1` (car 12s = 1 Woof).

## 5. Règle business à valider

- Les mentions Cloudinary / Render sont retirées de l'interface.
- Toutes les vidéos consomment des Woofs : 1 Woof par tranche de 12 secondes.
- Vérifiez dans le worker que l'insert renseigne `metadata.woofs` et que la RPC `debit_woofs` incrémente correctement le compteur.

## 6. (Optionnel) Propreté & configuration avancée

- **Custom domain** : ajoutez votre domaine dans Render (onglet *Custom Domains*) et reportez l'URL côté Supabase dans les **Allowed Origins**.
- **Previews par branche** : pour des démos de PR, créez un *Static Site* par branche ou activez les *Preview Deploys* automatiques.

---

Suivez cette checklist à chaque nouveau déploiement pour éviter les surprises côté produit et garantir une intégration Supabase / Render sans friction.
