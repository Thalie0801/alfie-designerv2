"use client";

import { useMemo, useState } from "react";
import ChatCard from "@/components/ChatCard";
import BriefExpress, { type Brief } from "@/components/BriefExpress";
import TipsCard from "@/components/TipsCard";
import TrendsCard from "@/components/TrendsCard";

export const dynamic = "force-dynamic";

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

export default function Page() {
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
      <div className="card">
        <ChatCard brief={normalizedBrief} />
      </div>

      <div className="card">
        <BriefExpress value={normalizedBrief} onChange={setBrief} />
      </div>

      <div className="grid2">
        <div className="card">
          <TipsCard />
        </div>
        <div className="card">
          <TrendsCard />
        </div>
      </div>

      <style jsx global>{`
        :root {
          color-scheme: light;
        }

        html, body {
          background: #f7f7f8;
          color: #101114;
        }

        .page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px 20px 80px;
          display: grid;
          gap: 14px;
        }

        .card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 12px;
        }

        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        @media (max-width: 860px) {
          .page {
            padding: 16px 16px 72px;
          }

          .grid2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
