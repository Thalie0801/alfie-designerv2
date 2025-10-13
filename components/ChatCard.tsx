"use client";

import { useState } from "react";
import ChatGenerator from "./ChatGenerator";
import type { Brief } from "./BriefExpress";

function describeBrief(brief: Brief) {
  if (brief.deliverable === "carousel") {
    const slides = brief.slides ?? 5;
    return `carrousel ${slides} ${slides > 1 ? "slides" : "slide"}`;
  }
  if (brief.deliverable === "video") {
    const duration = brief.duration ?? 30;
    return `vidéo ${duration}s`;
  }
  return "visuel unique";
}

interface ChatCardProps {
  brief: Brief;
}

export default function ChatCard({ brief }: ChatCardProps) {
  const [resetToken, setResetToken] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const summary = `${describeBrief(brief)} · ${brief.ratio} (${brief.resolution})`;

  return (
    <section className="chat-card">
      <header className="chat-card__header">
        <div>
          <h2>Alfie — Chat Generator</h2>
          <small>Brief actif&nbsp;: {summary}</small>
        </div>
        <div className="chat-card__actions">
          <span className="chat-card__badge" data-streaming={isStreaming}>
            {isStreaming ? "Génération…" : "IA active"}
          </span>
          <button
            type="button"
            className="chat-card__reset"
            onClick={() => setResetToken((value) => value + 1)}
          >
            Réinitialiser
          </button>
          <a className="chat-card__quota" href="/quota">
            Détail de mon quota
          </a>
        </div>
      </header>

      <ChatGenerator
        brief={brief}
        hideQuickIdeas
        hideQuota
        hideHeader
        resetToken={resetToken}
        onStreamingChange={setIsStreaming}
      />

      <style jsx>{`
        .chat-card {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .chat-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .chat-card__actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .chat-card__badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #1d2939;
          background: rgba(64, 87, 255, 0.16);
          border: 1px solid rgba(64, 87, 255, 0.25);
        }

        .chat-card__badge[data-streaming="true"] {
          color: #4338ca;
          background: rgba(64, 87, 255, 0.24);
        }

        h2 {
          margin: 0;
          font-size: 1.1rem;
          color: #111827;
        }

        small {
          color: #667085;
        }

        .chat-card__reset {
          border-radius: 999px;
          border: 1px solid #d1d5db;
          background: #f9fafb;
          color: #1f2937;
          padding: 6px 12px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease;
        }

        .chat-card__reset:hover {
          background: #eef2ff;
          border-color: rgba(64, 87, 255, 0.3);
        }

        .chat-card__quota {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: rgba(64, 87, 255, 0.08);
          color: #2535a0;
          padding: 6px 12px;
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 500;
          transition: background 0.2s ease, border-color 0.2s ease;
        }

        .chat-card__quota:hover {
          background: rgba(64, 87, 255, 0.12);
          border-color: rgba(64, 87, 255, 0.35);
        }
      `}</style>
    </section>
  );
}
