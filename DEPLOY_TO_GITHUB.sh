#!/bin/bash

echo "🚀 Alfie Designer - Déploiement sur GitHub"
echo "=========================================="
echo ""
echo "⚠️  IMPORTANT : Tu dois d'abord créer un Personal Access Token (PAT)"
echo ""
echo "📝 Étapes :"
echo "1. Va sur : https://github.com/settings/tokens"
echo "2. Clique sur 'Generate new token (classic)'"
echo "3. Sélectionne 'repo' (Full control)"
echo "4. Copie le token généré"
echo ""
read -p "As-tu créé ton token ? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Crée d'abord ton token sur GitHub, puis relance ce script."
    exit 1
fi

echo ""
read -p "Colle ton token ici : " TOKEN

if [ -z "$TOKEN" ]; then
    echo "❌ Token vide. Abandon."
    exit 1
fi

echo ""
echo "🔧 Configuration du remote avec le token..."
git remote set-url origin https://${TOKEN}@github.com/Thalie0801/Alfie-designer-2.git

echo "📤 Push vers GitHub..."
git push -u origin main --force

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Succès ! Ton code est maintenant sur GitHub !"
    echo "🔗 Voir le repo : https://github.com/Thalie0801/Alfie-designer-2"
else
    echo ""
    echo "❌ Erreur lors du push. Vérifie ton token."
fi
