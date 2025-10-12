import React from 'react';

type C = { used: number; total: number; label: string };
const Bar = ({ used, total, label }: C) => {
  const pct = Math.min(100, Math.round((used / Math.max(1,total)) * 100));
  const warn = pct >= 80;
  return (
    <div className="ad-counter">
      <div className="ad-header">
        <span>{label}</span>
        <span>{used} / {total}</span>
      </div>
      <div className={`ad-bar ${warn ? 'warn':''}`}>
        <div className="ad-fill" style={{ width: `${pct}%` }} />
      </div>
      <style jsx>{`
        .ad-counter { display:flex; flex-direction:column; gap:6px; }
        .ad-header { display:flex; justify-content:space-between; font-size:14px; }
        .ad-bar { height:8px; background:#eee; border-radius:999px; overflow:hidden; }
        .ad-bar.warn { background:#fdecea; }
        .ad-fill { height:100%; background:#222; }
      `}</style>
    </div>
  );
};

export default function Counters({ images, reels, woofs }:{images:C; reels:C; woofs:C}) {
  return (
    <div className="ad-counters">
      <Bar {...images}/>
      <Bar {...reels}/>
      <Bar {...woofs}/>
      <style jsx>{`
        .ad-counters { display:grid; gap:12px; grid-template-columns:1fr; }
      `}</style>
    </div>
  );
}
