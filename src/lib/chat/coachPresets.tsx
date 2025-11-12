// src/lib/chat/coachPresets.tsx
import React from "react";

export function chooseCarouselOutline(slides: number, seed = 0) {
  const banks = [
    { title: "Problème → Solution", seq: ["Le problème clé", "Pourquoi ça bloque", "La méthode", "Exemple rapide", "CTA clair"] },
    { title: "5 erreurs à éviter", seq: ["Erreur 1", "Erreur 2", "Erreur 3", "Erreur 4", "Erreur 5 + CTA"] },
    { title: "Checklist pratique", seq: ["Étape 1", "Étape 2", "Étape 3", "Étape 4", "Résumé + CTA"] },
    { title: "Mythes vs Réalité", seq: ["Mythe 1 → Réalité", "Mythe 2 → Réalité", "Mythe 3 → Réalité", "Conseil final", "CTA"] },
    { title: "Avant / Après", seq: ["Avant (constat)", "Après (objectif)", "Étapes", "Résultat attendu", "CTA"] },
  ];
  const idx = seed % banks.length;
  const base = banks[idx];
  const seq =
    base.seq.length === slides
      ? base.seq
      : [...base.seq, ...Array(Math.max(0, slides - base.seq.length)).fill("Conseil bonus")].slice(0, slides);
  return { title: base.title, slides: seq.map((x, i) => `${i + 1}. ${x}`) };
}

export function chooseVideoVariant(it: any, seed = 0) {
  const variants = [
    (
      <div className="text-sm">
        <p className="font-medium">Plan :</p>
        <ul className="list-disc ml-5">
          <li>Hook (3–5s) : bénéfice</li>
          <li>3 points clés (preuves, tips)</li>
          <li>CTA : {it.cta ?? "En savoir plus"}</li>
        </ul>
      </div>
    ),
    (
      <div className="text-sm">
        <p className="font-medium">Script flash pour “{it.topic}”</p>
        <ul className="list-disc ml-5">
          <li>Intro : “Tu galères avec… ?”</li>
          <li>Astuce 1 / 2 / 3 (visuelles)</li>
          <li>Conclusion : bénéfice + CTA</li>
        </ul>
      </div>
    ),
  ];
  return variants[seed % variants.length];
}

export function chooseImageVariant(it: any, seed = 0) {
  const variants = [
    (
      <div className="text-sm">
        <p className="font-medium">Suggestion :</p>
        <ul className="list-disc ml-5">
          <li>Titre court avec bénéfice</li>
          <li>Sous-titre preuve (chiffre, résultat)</li>
          <li>Badge ou CTA : {it.cta ?? "Découvrir"}</li>
        </ul>
      </div>
    ),
    (
      <div className="text-sm">
        <p className="font-medium">Concept express pour “{it.topic ?? "ton sujet"}”</p>
        <ul className="list-disc ml-5">
          <li>Zone titre dominante</li>
          <li>Contraste fort (fond clair + typo sombre)</li>
          <li>Élément de preuve (⭐, %)</li>
        </ul>
      </div>
    ),
  ];
  return variants[seed % variants.length];
}
