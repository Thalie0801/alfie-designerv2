"use client";

import { useMemo, type ChangeEvent } from "react";
import styles from "./BriefExpress.module.css";
import type { Brief, BriefDeliverable, BriefRatio } from "../lib/types/brief";

const ratioResolutions: Record<BriefRatio, string> = {
  "9:16": "1080x1920",
  "1:1": "1080x1080",
  "4:5": "1080x1350",
  "16:9": "1920x1080",
};

const deliverableLabels: Record<BriefDeliverable, string> = {
  image: "Image",
  carousel: "Carrousel",
  video: "Vidéo",
};

const ratioLabels: Array<{ value: BriefRatio; label: string }> = [
  { value: "9:16", label: "9:16 — Story/Reel" },
  { value: "1:1", label: "1:1 — Carré" },
  { value: "4:5", label: "4:5 — Portrait" },
  { value: "16:9", label: "16:9 — Paysage" },
];

export interface BriefExpressProps {
  value: Brief;
  onChange: (next: Brief) => void;
}

function BriefExpress({ value, onChange }: BriefExpressProps) {
  const formattedResolution = useMemo(() => ratioResolutions[value.ratio], [value.ratio]);

  const handleDeliverableChange = (deliverable: BriefDeliverable) => {
    if (value.deliverable === deliverable) return;
    const base: Brief = {
      ...value,
      deliverable,
      useBrandKit: true,
    };

    if (deliverable === "carousel") {
      const { duration, ...rest } = base;
      onChange({ ...rest, slides: value.slides ?? 5 });
      return;
    }

    if (deliverable === "video") {
      const { slides, ...rest } = base;
      onChange({ ...rest, duration: value.duration ?? 30 });
      return;
    }

    const { slides, duration, ...rest } = base;
    onChange(rest);
  };

  const handleRatioChange = (ratio: BriefRatio) => {
    if (value.ratio === ratio) return;
    const resolution = ratioResolutions[ratio];
    onChange({ ...value, ratio, resolution });
  };

  const handleSlidesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10);
    const slides = Number.isNaN(parsed) ? undefined : Math.max(1, parsed);
    onChange({ ...value, slides: slides ?? 5 });
  };

  const handleDurationChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10);
    const duration = Number.isNaN(parsed) ? undefined : Math.max(5, parsed);
    onChange({ ...value, duration: duration ?? 30 });
  };

  return (
    <section className={styles.container} aria-labelledby="brief-express-heading">
      <div className={styles.header}>
        <h2 id="brief-express-heading" className={styles.title}>
          Brief Express
        </h2>
        <p className={styles.subtitle}>
          Sélectionne ton livrable et ajuste les paramètres essentiels. Alfie applique automatiquement ton Brand Kit.
        </p>
      </div>

      <div>
        <p className={styles.sectionLabel}>Type de livrable</p>
        <div className={styles.segmentGroup} role="radiogroup" aria-label="Type de livrable">
          {(Object.keys(deliverableLabels) as BriefDeliverable[]).map((deliverable) => (
            <button
              key={deliverable}
              type="button"
              role="radio"
              aria-checked={value.deliverable === deliverable}
              className={styles.segmentButton}
              data-active={value.deliverable === deliverable}
              onClick={() => handleDeliverableChange(deliverable)}
            >
              {deliverableLabels[deliverable]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={styles.sectionLabel}>Format</p>
        <div className={styles.chips} role="group" aria-label="Ratio">
          {ratioLabels.map((ratio) => (
            <button
              key={ratio.value}
              type="button"
              className={styles.chip}
              data-active={value.ratio === ratio.value}
              onClick={() => handleRatioChange(ratio.value)}
            >
              {ratio.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.inputsGrid}>
        <div className={styles.inputGroup}>
          <label className={styles.inputLabel} htmlFor="resolution-field">
            Résolution auto
          </label>
          <input
            id="resolution-field"
            className={`${styles.inputField} ${styles.readonlyField}`}
            value={formattedResolution}
            readOnly
          />
        </div>

        {value.deliverable === "carousel" && (
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="slides-field">
              Slides
            </label>
            <input
              id="slides-field"
              type="number"
              min={1}
              className={styles.inputField}
              value={value.slides ?? 5}
              onChange={handleSlidesChange}
            />
          </div>
        )}

        {value.deliverable === "video" && (
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="duration-field">
              Durée (secondes)
            </label>
            <input
              id="duration-field"
              type="number"
              min={5}
              className={styles.inputField}
              value={value.duration ?? 30}
              onChange={handleDurationChange}
            />
          </div>
        )}
      </div>

      {/* Astuces et Prompts déplacés dans leurs cartes dédiées */}
    </section>
  );
}

export { BriefExpress };
export default BriefExpress;
export type { Brief };
