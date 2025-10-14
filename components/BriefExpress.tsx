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

const PRESETS: Array<{
  id: string;
  label: string;
  hint: string;
  values: Partial<Brief>;
}> = [
  {
    id: "story-launch",
    label: "Story lancement",
    hint: "Visuel vertical lumineux",
    values: {
      deliverable: "image",
      ratio: "9:16",
      tone: "Enthousiaste",
      ambiance: "Lumineuse, dynamique",
      constraints: "Ajouter le logo en bas à droite",
    },
  },
  {
    id: "carousel-proof",
    label: "Carrousel preuve",
    hint: "6 slides narratifs",
    values: {
      deliverable: "carousel",
      ratio: "4:5",
      slides: 6,
      tone: "Convaincant",
      ambiance: "Palette de la marque",
      constraints: "Prévoir un CTA final",
    },
  },
  {
    id: "video-recap",
    label: "Vidéo 30s",
    hint: "Script synthétique",
    values: {
      deliverable: "video",
      ratio: "16:9",
      duration: 30,
      tone: "Rassurant",
      ambiance: "Studio sobre",
      constraints: "Inclure un écran titre et un écran CTA",
    },
  },
];

const QUOTAS = [
  { id: "images", label: "Images", used: 6, limit: 20, color: "#4057FF" },
  { id: "carousels", label: "Carrousels", used: 2, limit: 8, color: "#8b5cf6" },
  { id: "videos", label: "Vidéos", used: 1, limit: 5, color: "#f97316" },
];

export interface BriefExpressProps {
  value: Brief;
  onChange: (next: Brief) => void;
}

function BriefExpress({ value, onChange }: BriefExpressProps) {
  const formattedResolution = useMemo(() => ratioResolutions[value.ratio], [value.ratio]);

  const handlePresetSelect = (presetId: string) => {
    if (value.presetId === presetId) {
      onChange({ ...value, presetId: undefined });
      return;
    }
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    const nextDeliverable = preset.values.deliverable ?? value.deliverable;
    const nextRatio = (preset.values.ratio ?? value.ratio) as BriefRatio;
    const resolution = ratioResolutions[nextRatio];
    const nextTone = preset.values.tone ?? value.tone ?? "";
    const nextAmbiance = preset.values.ambiance ?? value.ambiance ?? "";
    const nextConstraints = preset.values.constraints ?? value.constraints ?? "";

    let next: Brief = {
      ...value,
      ...preset.values,
      deliverable: nextDeliverable,
      ratio: nextRatio,
      resolution,
      tone: nextTone,
      ambiance: nextAmbiance,
      constraints: nextConstraints,
      presetId,
      useBrandKit: true,
    };

    if (nextDeliverable === "carousel") {
      next = {
        ...next,
        slides: preset.values.slides ?? value.slides ?? 5,
      };
      delete next.duration;
    } else if (nextDeliverable === "video") {
      next = {
        ...next,
        duration: preset.values.duration ?? value.duration ?? 30,
      };
      delete next.slides;
    } else {
      delete next.slides;
      delete next.duration;
    }

    onChange(next);
  };

  const handleDeliverableChange = (deliverable: BriefDeliverable) => {
    if (value.deliverable === deliverable) return;
    const base: Brief = {
      ...value,
      deliverable,
      useBrandKit: true,
      presetId: undefined,
    };

    if (deliverable === "carousel") {
      const { duration, ...rest } = base;
      onChange({ ...rest, slides: value.slides ?? 5, presetId: undefined });
      return;
    }

    if (deliverable === "video") {
      const { slides, ...rest } = base;
      onChange({ ...rest, duration: value.duration ?? 30, presetId: undefined });
      return;
    }

    const { slides, duration, ...rest } = base;
    onChange(rest);
  };

  const handleRatioChange = (ratio: BriefRatio) => {
    if (value.ratio === ratio) return;
    const resolution = ratioResolutions[ratio];
    onChange({ ...value, ratio, resolution, presetId: undefined });
  };

  const handleSlidesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10);
    const slides = Number.isNaN(parsed) ? undefined : Math.max(1, parsed);
    onChange({ ...value, slides: slides ?? 5, presetId: undefined });
  };

  const handleDurationChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseInt(event.target.value, 10);
    const duration = Number.isNaN(parsed) ? undefined : Math.max(5, parsed);
    onChange({ ...value, duration: duration ?? 30, presetId: undefined });
  };

  const handleToneChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, tone: event.target.value, presetId: undefined });
  };

  const handleAmbianceChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, ambiance: event.target.value, presetId: undefined });
  };

  const handleConstraintsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ ...value, constraints: event.target.value, presetId: undefined });
  };

  return (
    <section className={styles.container} aria-labelledby="brief-express-heading">
      <div className={styles.header}>
        <h2 id="brief-express-heading" className={styles.title}>
          Brief express
        </h2>
        <p className={styles.subtitle}>
          Ton Brand Kit est déjà appliqué. Choisis le livrable, ajuste le format et précise le ton ou les contraintes en quelques clics.
        </p>
      </div>

      <div>
        <p className={styles.sectionLabel}>Préréglages</p>
        <div className={styles.presetsRow} role="group" aria-label="Préréglages enregistrés">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={styles.presetChip}
              data-active={value.presetId === preset.id}
              aria-pressed={value.presetId === preset.id}
              onClick={() => handlePresetSelect(preset.id)}
            >
              <span>{preset.label}</span>
              <small>{preset.hint}</small>
            </button>
          ))}
        </div>
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

      <div className={styles.parametersSection}>
        <p className={styles.sectionLabel}>Paramètres</p>
        <div className={styles.parametersGrid}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="tone-field">
              Ton
            </label>
            <input
              id="tone-field"
              className={styles.inputField}
              placeholder="ex. Chaleureux, direct, premium"
              value={value.tone ?? ""}
              onChange={handleToneChange}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel} htmlFor="ambiance-field">
              Ambiance
            </label>
            <input
              id="ambiance-field"
              className={styles.inputField}
              placeholder="ex. Lumière naturelle, ambiance studio"
              value={value.ambiance ?? ""}
              onChange={handleAmbianceChange}
            />
          </div>

          <div className={`${styles.inputGroup} ${styles.constraintsGroup}`}>
            <label className={styles.inputLabel} htmlFor="constraints-field">
              Contraintes
            </label>
            <textarea
              id="constraints-field"
              className={`${styles.inputField} ${styles.textArea}`}
              placeholder="Logo obligatoire, zones à éviter, mentions légales…"
              value={value.constraints ?? ""}
              onChange={handleConstraintsChange}
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className={styles.quotaSection} aria-label="Suivi des quotas">
        <div className={styles.quotaHeader}>
          <span className={styles.sectionLabel}>Quotas</span>
          <span className={styles.quotaReset}>Reset le 1 nov.</span>
        </div>
        <div className={styles.quotaList}>
          {QUOTAS.map((quota) => {
            const limit = Math.max(1, quota.limit);
            const used = Math.max(0, quota.used);
            const percentage = Math.min(100, Math.round((used / limit) * 100));
            return (
              <div key={quota.id} className={styles.quotaItem}>
                <div className={styles.quotaItemHeader}>
                  <span>{quota.label}</span>
                  <span>
                    {used}/{limit}
                  </span>
                </div>
                <div className={styles.quotaTrack}>
                  <div className={styles.quotaFill} style={{ width: `${percentage}%`, background: quota.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export { BriefExpress };
export default BriefExpress;
export type { Brief };
