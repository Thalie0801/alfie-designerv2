/**
 * Refonte V1 — Codemod
 * Objectifs:
 *  - Remplacer toute logique "push/publish" → PULL (Canva link) côté app
 *  - Interdire autopublication sociale (V1)
 *  - Harmoniser terminologie et endpoints côté client
 *  - Préparer l’intégration "Woofs" (Premium T2V) via modale explicite
 *  - Ne JAMAIS toucher la landing (filtré par run.sh / CI)
 * Source: Cahier des charges Refonte (oct 2025). */
module.exports = function (fileInfo, api, options) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // 1) Renommer symboles contenant 'push'→'pull' pour flux Canva
  root.find(j.Identifier).forEach(p => {
    const n = p.node.name;
    if (/push.*canva/i.test(n)) p.node.name = n.replace(/push/i, 'pull');
    if (/publish.*canva/i.test(n)) p.node.name = n.replace(/publish/i, 'pull');
  });

  // 2) Chaînes de route/endpoints obsolètes → nouveaux endpoints PULL
  root.find(j.Literal, { value: '/v1/publish' })
    .forEach(p => { p.node.value = '/v1/creations/:id/deliver'; });
  root.find(j.Literal, { value: '/v1/canva/push' })
    .forEach(p => { p.node.value = '/v1/creations/:id/deliver'; });

  // 3) Remplacer appels à publishToSocial(...) par une erreur explicite (V1)
  root.find(j.CallExpression, { callee: { type: 'Identifier', name: /^(publishToSocial|autoPublish|schedulePost)$/ } })
    .replaceWith(() =>
      j.throwStatement(
        j.newExpression(j.Identifier('Error'), [j.literal('Auto publication désactivée en V1 (livraison PULL uniquement).')])
      )
    );

  // 4) Alias génériques 'push'→'pull' dans string literals quand lié à Canva/publication
  root.find(j.Literal).forEach(p => {
    if (typeof p.node.value === 'string') {
      const v = p.node.value;
      if (/canva/i.test(v) && /push|publish/i.test(v)) {
        p.node.value = v.replace(/publish|push/gi, 'pull');
      }
    }
  });

  // 5) Premium T2V — insérer un flag "requiresPremiumConfirmation" si on détecte premiumT2V(true)
  root.find(j.ObjectExpression).forEach(path => {
    const hasPremium = path.node.properties.some(prop =>
      prop.key && prop.key.name === 'premiumT2V' && prop.value && prop.value.value === true);
    const alreadyFlagged = path.node.properties.some(prop => prop.key && prop.key.name === 'requiresPremiumConfirmation');
    if (hasPremium && !alreadyFlagged) {
      path.node.properties.push(
        j.property('init', j.identifier('requiresPremiumConfirmation'), j.literal(true))
      );
    }
  });

  // 6) Messages UI — clarifier PULL
  root.find(j.Literal).forEach(p => {
    if (typeof p.node.value === 'string' && /publ(i|)cation auto|auto.?publish/i.test(p.node.value)) {
      p.node.value = 'Livraison PULL : Ouvrir dans Canva + ZIP. Aucune publication automatique.';
    }
  });

  return root.toSource({ quote: 'single' });
};
