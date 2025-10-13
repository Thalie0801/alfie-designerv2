"use client";

import { useMemo, useState } from "react";
import ChatCard from "@/components/ChatCard";
import BriefExpress, { type Brief } from "@/components/BriefExpress";
import TipsCard from "@/components/TipsCard";
import TrendsCard from "@/components/TrendsCard";

interface HomePageClientProps {
  embedded?: boolean;
}

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

export default function HomePageClient({ embedded = false }: HomePageClientProps = {}) {
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);

  const normalizedBrief = useMemo(() => {
    const resolution = ratioResolutions[brief.ratio];
    if (brief.resolution === resolution) {
      return brief;
    }
    return { ...brief, resolution };
  }, [brief]);

  const wrapperClass = embedded ? "embedded-wrapper" : "container";

  return (
    <div className={wrapperClass}>
      <div className="chat-grid">
        <div className="card panel">
          <ChatCard brief={normalizedBrief} />
        </div>

        <div className="card panel">
          <BriefExpress value={normalizedBrief} onChange={setBrief} />
        </div>

        <div className="secondary-grid">
          <div className="card panel">
            <TipsCard />
          </div>
          <div className="card panel">
            <TrendsCard />
          </div>
        </div>
      </div>

      <style jsx>{`
        .chat-grid {
          display: grid;
          gap: 16px;
        }

        .secondary-grid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .panel {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 20px;
        }

        @media (max-width: 1024px) {
          .secondary-grid {
            grid-template-columns: 1fr;
          }
        }

        .embedded-wrapper {
          padding: 0;
        }

        .embedded-wrapper .panel {
          box-shadow: none;
        }
      `}</style>
    </div>
  );
}
