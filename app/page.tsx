"use client";

import { useMemo, useState } from "react";
import { BriefExpress } from "../components/BriefExpress";
import { ChatGenerator } from "../components/ChatGenerator";
import type { Brief } from "../components/BriefExpress";

const DEFAULT_BRIEF: Brief = {
  deliverable: "image",
  ratio: "9:16",
  resolution: "1080x1920",
  useBrandKit: true,
};

export default function HomePage() {
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const briefWithResolution = useMemo(() => {
    const ratioResolutions: Record<Brief["ratio"], string> = {
      "9:16": "1080x1920",
      "1:1": "1080x1080",
      "4:5": "1080x1350",
      "16:9": "1920x1080",
    };
    const resolution = ratioResolutions[brief.ratio];
    if (brief.resolution === resolution) return brief;
    return { ...brief, resolution };
  }, [brief]);

  return (
    <main className="page">
      <div className="page__inner">
        <BriefExpress
          value={briefWithResolution}
          onChange={setBrief}
          onPromptSelect={setPendingPrompt}
        />
      </div>

      <ChatGenerator
        brief={briefWithResolution}
        pendingPrompt={pendingPrompt}
        onPromptConsumed={() => setPendingPrompt(null)}
      />

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: linear-gradient(180deg, #f6f7ff 0%, #ffffff 35%);
          padding: 32px 0 64px;
        }

        .page__inner {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 24px;
        }

        @media (max-width: 860px) {
          .page {
            padding: 20px 0 64px;
          }

          .page__inner {
            padding: 0 16px;
          }
        }
      `}</style>
    </main>
  );
}
