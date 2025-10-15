# 🚀 Comment pousser sur GitHub

## Étape 1 : Créer un Personal Access Token (PAT)

1. Va sur GitHub : https://github.com/settings/tokens
2. Clique sur "Generate new token" → "Generate new token (classic)"
3. Donne un nom au token : `Alfie Designer Push`
4. Sélectionne les permissions :
   - ✅ `repo` (Full control of private repositories)
5. Clique sur "Generate token"
6. **COPIE LE TOKEN** (tu ne pourras plus le voir après !)

## Étape 2 : Configurer Git avec le token

```bash
# Configure ton identité
git config user.email "nathaliestaelens@gmail.com"
git config user.name "Thalie0801"

# Ajoute le remote avec le token
git remote set-url origin https://YOUR_TOKEN@github.com/Thalie0801/Alfie-designer-2.git
```

Remplace `YOUR_TOKEN` par le token que tu as copié.

## Étape 3 : Pousser le code

```bash
# Pousse sur la branche main
git push -u origin main --force
```

## Alternative : Utiliser SSH

Si tu préfères utiliser SSH :

```bash
# Génère une clé SSH
ssh-keygen -t ed25519 -C "nathaliestaelens@gmail.com"

# Copie la clé publique
cat ~/.ssh/id_ed25519.pub

# Ajoute la clé sur GitHub : https://github.com/settings/keys

# Change le remote en SSH
git remote set-url origin git@github.com:Thalie0801/Alfie-designer-2.git

# Pousse
git push -u origin main
```

## Vérification

Une fois poussé, vérifie sur : https://github.com/Thalie0801/Alfie-designer-2

---

**Note** : Le code est déjà commité localement. Il ne reste plus qu'à le pousser sur GitHub avec l'une des méthodes ci-dessus.
