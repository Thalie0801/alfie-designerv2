import React from "react";
import type { Brief } from "../../hooks/useBrief";

type IntentDetails = Pick<Brief, "cta" | "topic">;

function pickIndex(length: number, seed: number) {
  if (length <= 0) return 0;
  const normalised = Number.isFinite(seed) ? seed : 0;
  return Math.abs(Math.trunc(normalised)) % length;
}

export function chooseCarouselOutline(slides: number, seed = 0) {
  const banks = [
    { title: "Problème → Solution", seq: ["Le problème clé", "Pourquoi ça bloque", "La méthode", "Exemple rapide", "CTA clair"] },
    { title: "5 erreurs à éviter", seq: ["Erreur 1", "Erreur 2", "Erreur 3", "Erreur 4", "Erreur 5 + CTA"] },
    { title: "Checklist pratique", seq: ["Étape 1", "Étape 2", "Étape 3", "Étape 4", "Résumé + CTA"] },
    { title: "Mythes vs Réalité", seq: ["Mythe 1 → Réalité", "Mythe 2 → Réalité", "Mythe 3 → Réalité", "Conseil final", "CTA"] },
    { title: "Avant / Après", seq: ["Avant (constat)", "Après (objectif)", "Étapes", "Résultat attendu", "CTA"] },
  ] as const;

  const effectiveSlides = Math.max(1, Math.trunc(slides));
  const base = banks[pickIndex(banks.length, seed)];
  const seq =
    base.seq.length === effectiveSlides
      ? base.seq
      : [...base.seq, ...Array(Math.max(0, effectiveSlides - base.seq.length)).fill("Conseil bonus")].slice(0, effectiveSlides);

  return { title: base.title, slides: seq.map((label, index) => `${index + 1}. ${label}`) };
}

function fallbackCta(cta: IntentDetails["cta"], fallback: string) {
  const trimmed = cta?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function chooseVideoVariant(intent: IntentDetails, seed = 0): React.ReactElement {
  const variants: React.ReactElement[] = [
    (
      <div className="text-sm">
        <p className="font-medium">Plan :</p>
        <ul className="list-disc ml-5">
          <li>Hook (3–5s) : bénéfice</li>
          <li>3 points clés (preuves, tips)</li>
          <li>CTA : {fallbackCta(intent.cta, "En savoir plus")}</li>
        </ul>
      </div>
    ),
    (
      <div className="text-sm">
        <p className="font-medium">Script flash pour &quot;{intent.topic ?? "ton sujet"}&quot;</p>
        <ul className="list-disc ml-5">
          <li>Intro : &quot;Tu galères avec… ?&quot;</li>
          <li>Astuce 1 / 2 / 3 (visuelles)</li>
          <li>Conclusion : bénéfice + CTA</li>
        </ul>
      </div>
    ),
  ];

  return variants[pickIndex(variants.length, seed)];
}

export function chooseImageVariant(intent: IntentDetails, seed = 0): React.ReactElement {
  const variants: React.ReactElement[] = [
    (
      <div className="text-sm">
        <p className="font-medium">Suggestion :</p>
        <ul className="list-disc ml-5">
          <li>Titre court avec bénéfice</li>
          <li>Sous-titre preuve (chiffre, résultat)</li>
          <li>Badge ou CTA : {fallbackCta(intent.cta, "Découvrir")}</li>
        </ul>
      </div>
    ),
    (
      <div className="text-sm">
        <p className="font-medium">Concept express pour &quot;{intent.topic ?? "ton sujet"}&quot;</p>
        <ul className="list-disc ml-5">
          <li>Zone titre dominante</li>
          <li>Contraste fort (fond clair + typo sombre)</li>
          <li>Élément de preuve (⭐, %)</li>
        </ul>
      </div>
    ),
  ];

  return variants[pickIndex(variants.length, seed)];
}
