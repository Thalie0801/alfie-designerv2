"use client";
import ChatGenerator from "@/components/ChatGenerator";
import type { Brief } from "@/components/BriefExpress";

export default function ChatCard({ brief }: { brief: Brief }) {
  return (
    <section>
      <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"6px 8px 10px"}}>
        <div>
          <h2 style={{margin:0,fontSize:"1.1rem"}}>Alfie — Chat Generator</h2>
          <small style={{color:"#667085"}}>
            Brief actif : {brief.deliverable === "carousel" ? `carrousel ${brief.slides ?? 5} slides` : brief.deliverable === "video" ? `vidéo ${brief.duration ?? 30}s` : "visuel unique"}
            {" · "}{brief.ratio} ({brief.resolution})
          </small>
        </div>
      </header>
      <ChatGenerator brief={brief} hideQuickIdeas hideQuota />
    </section>
  );
}
