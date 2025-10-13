import { useEffect, useMemo, useState } from "react";
import styles from "./Creator.module.css";
import type { Brief } from "../../lib/types/brief";
import BriefExpress from "../../components/BriefExpress";
import ChatGenerator from "../../components/ChatGenerator";
import { useBrandKit } from "@/hooks/useBrandKit";
import { getQuotaStatus, type QuotaStatus } from "@/utils/quotaManager";

const ratioResolutions: Record<Brief["ratio"], string> = {
  "9:16": "1080x1920",
  "1:1": "1080x1080",
  "4:5": "1080x1350",
  "16:9": "1920x1080",
};

const DEFAULT_BRIEF: Brief = {
  deliverable: "image",
  ratio: "9:16",
  resolution: ratioResolutions["9:16"],
  useBrandKit: true,
};

export default function Creator() {
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);

  const { activeBrandId, activeBrand } = useBrandKit();

  useEffect(() => {
    let cancelled = false;

    if (!activeBrandId) {
      setQuotaStatus(null);
      return undefined;
    }

    setQuotaLoading(true);
    getQuotaStatus(activeBrandId)
      .then((status) => {
        if (!cancelled) {
          setQuotaStatus(status);
        }
      })
      .catch((error) => {
        console.error("Erreur récupération quotas:", error);
        if (!cancelled) {
          setQuotaStatus(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setQuotaLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeBrandId]);

  const briefWithResolution = useMemo(() => {
    const expectedResolution = ratioResolutions[brief.ratio];
    if (brief.resolution === expectedResolution) {
      return brief;
    }
    return { ...brief, resolution: expectedResolution };
  }, [brief]);

  const quotaSnapshot = useMemo(() => {
    if (!quotaStatus) return undefined;
    const snapshot = [
      {
        label: "Visuels",
        used: quotaStatus.visuals.used,
        limit: quotaStatus.visuals.limit,
        color: "#4057ff",
      },
      {
        label: "Vidéos",
        used: quotaStatus.videos.used,
        limit: quotaStatus.videos.limit,
        color: "#24c08a",
      },
      {
        label: "Woofs",
        used: quotaStatus.woofs.consumed,
        limit: quotaStatus.woofs.limit,
        color: "#f59f00",
      },
    ];

    return snapshot.filter((item) => item.limit > 0 || item.used > 0);
  }, [quotaStatus]);

  const quotaStatusLabel = useMemo(() => {
    if (!quotaStatus?.resetsOn) {
      return undefined;
    }
    try {
      const resetDate = new Date(quotaStatus.resetsOn);
      if (Number.isNaN(resetDate.getTime())) {
        return undefined;
      }
      return `Réinitialisation le ${resetDate.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
      })}`;
    } catch (error) {
      console.error("Format date quota invalide:", error);
      return undefined;
    }
  }, [quotaStatus]);

  const chatApiUrl = import.meta.env?.VITE_ALFIE_CHAT_URL ?? "/api/alfie/chat";

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.headerBadge}>Studio</span>
            <h1 className={styles.title}>Chat Generator avec Alfie</h1>
            <p className={styles.subtitle}>
              Compose ton brief idéal, sélectionne les bons formats et laisse Alfie produire visuels, vidéos ou copy.
              Le moteur de réponse reste piloté par Alfie pour la création et la livraison.
            </p>
          </div>
          <div className={styles.headerMeta}>
            <span className={styles.activeBadge}>IA active</span>
            <span className={styles.brandBadge}>
              Brand Kit appliqué
              {activeBrand?.name ? ` — ${activeBrand.name}` : " automatiquement"}
            </span>
          </div>
        </header>

        <div className={styles.grid}>
          <aside className={styles.sidebar}>
            <BriefExpress value={briefWithResolution} onChange={setBrief} />
          </aside>

          <div className={styles.chatColumn}>
            <ChatGenerator
              brief={briefWithResolution}
              quotaSnapshot={quotaSnapshot}
              quotaStatusLabel={quotaStatusLabel}
              brandName={quotaStatus?.brandName ?? activeBrand?.name ?? undefined}
              quotaLoading={quotaLoading}
              chatApiUrl={chatApiUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
