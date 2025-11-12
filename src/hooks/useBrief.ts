import { useCallback, useMemo, useState } from "react";

export type Brief = {
  goal?: "awareness"|"traffic"|"leads"|"sales";
  audience?: string;
  platform?: "instagram"|"tiktok"|"pinterest"|"linkedin"|"youtube";
  format?: "image"|"carousel"|"video";
  ratio?: "1:1"|"4:5"|"9:16"|"16:9"|"2:3"|"3:4";
  tone?: "premium"|"fun"|"b2b"|"educ"|string|null;
  topic?: string;
  cta?: string;
  slides?: number;
  hooks?: string[];
  brand?: { colors?: string[]; fonts?: string[]; voice?: string };
};

const KEY = "alfie_prefill_brief";

export function useBrief() {
  const initial = useMemo<Brief>(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  }, []);
  const [state, setState] = useState<Brief>(initial);

  const merge = useCallback((patch: Partial<Brief>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState({});
    try { sessionStorage.removeItem(KEY); } catch {}
  }, []);

  const score = useMemo(() => {
    // Score de clarté 0–100
    let s = 0;
    if (state.format) s += 15;
    if (state.platform) s += 15;
    if (state.ratio) s += 10;
    if (state.topic && state.topic.length >= 8) s += 30;
    if (state.cta) s += 10;
    if (state.tone) s += 10;
    if (state.slides || state.format !== "carousel") s += 10;
    return Math.min(100, s);
  }, [state]);

  return { state, merge, reset, score };
}
