"use client";

import { useMemo, useState } from "react";
import ChatCard from "@/components/ChatCard";
import BriefExpress, { type Brief } from "@/components/BriefExpress";
import TipsCard from "@/components/TipsCard";
import TrendsCard from "@/components/TrendsCard";

const ratioResolutions: Record<Brief["ratio"], string> = {
  "9:16": "1080x1920",
  "1:1": "1080x1080",
  "4:5": "1080x1350",
  "16:9": "1920x1080",
};

const ACTIVE_BRAND = {
  id: "brand_demo_studio",
  name: "Maison Horizon",
};

const DEFAULT_BRIEF: Brief = {
  deliverable: "image",
  ratio: "9:16",
  resolution: ratioResolutions["9:16"],
  useBrandKit: true,
  brandId: ACTIVE_BRAND.id,
  tone: "",
  ambiance: "",
  constraints: "",
};

export default function HomePageClient() {
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);

  const normalizedBrief = useMemo(() => {
    const resolution = ratioResolutions[brief.ratio];
    if (brief.resolution === resolution) {
      return brief;
    }
    return { ...brief, resolution };
  }, [brief]);

  return (
    <div className="page">
      <header className="studioHeader">
        <div className="headerPrimary">
          <span className="studioBadge">STUDIO</span>
          <div>
            <h1 className="pageTitle">Créer avec Alfie</h1>
            <p className="pageSubtitle">
              Brief commun, rendu aligné : Alfie s'occupe de la production pendant que tu te concentres sur l'idée.
            </p>
          </div>
        </div>
        <div className="headerActions">
          <div className="headerBadges">
            <span className="aiBadge">IA active</span>
            <span className="brandBadge">Brand Kit — {ACTIVE_BRAND.name}</span>
          </div>
          <button type="button" className="changeBrandButton">
            Changer de marque
          </button>
        </div>
      </header>

      <main className="canvas">
        <section className="conversation" aria-labelledby="creation-conversation">
          <ChatCard brief={normalizedBrief} brandName={ACTIVE_BRAND.name} />
        </section>

        <details className="briefPanel" open>
          <summary>Brief &amp; paramètres</summary>
          <div className="briefBody">
            <BriefExpress value={normalizedBrief} onChange={setBrief} />
          </div>
        </details>
      </main>

      <section className="extras">
        <div className="extraCard">
          <TipsCard />
        </div>
        <div className="extraCard">
          <TrendsCard />
        </div>
      </section>

      <style jsx global>{`
        .page{max-width:1200px;margin:0 auto;padding:12px 20px 80px;display:flex;flex-direction:column;gap:20px}
        .studioHeader{position:sticky;top:0;z-index:20;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;background:linear-gradient(180deg,#ffffff 0%,rgba(255,255,255,0.92) 100%);padding:16px 0 12px;border-bottom:1px solid rgba(15,23,42,0.08)}
        .headerPrimary{display:flex;align-items:flex-start;gap:16px}
        .studioBadge{display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 10px;border-radius:999px;background:#101828;color:#f5f5f5;font-weight:600;font-size:0.75rem;letter-spacing:0.08em}
        .pageTitle{margin:0;font-size:1.75rem;font-weight:700;color:#0f172a}
        .pageSubtitle{margin:6px 0 0;color:#475467;font-size:0.95rem;max-width:520px}
        .headerActions{display:flex;flex-direction:column;align-items:flex-end;gap:12px}
        .headerBadges{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
        .aiBadge,.brandBadge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 14px;font-weight:600;font-size:0.85rem;white-space:nowrap}
        .aiBadge{background:rgba(64,87,255,0.12);color:#2535a0}
        .brandBadge{background:rgba(16,24,40,0.08);color:#101828}
        .changeBrandButton{appearance:none;border:1px solid rgba(15,23,42,0.12);background:#ffffff;color:#101828;border-radius:12px;padding:10px 16px;font-weight:600;cursor:pointer;transition:all 0.2s ease}
        .changeBrandButton:hover{border-color:rgba(64,87,255,0.35);color:#2535a0}
        .canvas{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:20px;align-items:start}
        .conversation{background:#ffffff;border-radius:18px;border:1px solid rgba(15,23,42,0.08);box-shadow:0 20px 48px rgba(15,23,42,0.08);overflow:hidden}
        .briefPanel{position:sticky;top:108px;border-radius:18px;border:1px solid rgba(15,23,42,0.08);background:#ffffff;box-shadow:0 12px 28px rgba(15,23,42,0.06);padding:0;overflow:hidden}
        .briefPanel>summary{display:none}
        .briefBody{padding:0}
        .extras{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
        .extraCard{background:#ffffff;border-radius:16px;border:1px solid rgba(15,23,42,0.08);padding:16px;box-shadow:0 12px 24px rgba(15,23,42,0.06)}
        @media (max-width:1100px){
          .canvas{grid-template-columns:1fr}
          .briefPanel{position:static}
        }
        @media (max-width:860px){
          .studioHeader{flex-direction:column;align-items:flex-start;padding:12px 0 8px}
          .headerActions{width:100%;align-items:flex-start}
          .headerBadges{justify-content:flex-start}
          .changeBrandButton{width:100%}
          .conversation{order:1}
          .briefPanel{order:2}
          .briefPanel>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;list-style:none;padding:16px 20px;font-weight:600;font-size:1rem;color:#0f172a;cursor:pointer}
          .briefPanel[open]{border-radius:18px}
          .briefPanel:not([open]){border-bottom-left-radius:18px;border-bottom-right-radius:18px}
          .briefBody{padding:0 20px 20px}
          .extras{grid-template-columns:1fr}
        }
      `}</style>
    </div>
  );
}
