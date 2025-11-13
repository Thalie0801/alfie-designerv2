import { useCallback, useMemo, useState } from "react";

export type Brief = {
  goal?: "awareness" | "traffic" | "leads" | "sales";
  audience?: string;
  platform?: "instagram" | "tiktok" | "pinterest" | "linkedin" | "youtube";
  format?: "image" | "carousel" | "video";
  ratio?: "1:1" | "4:5" | "9:16" | "16:9" | "2:3" | "3:4";
  tone?: "premium" | "fun" | "b2b" | "educ" | string | null;
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

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch (error) {
    void error;
    return null;
  }
}

export function useBrief() {
  const initial = useMemo<Brief>(() => {
    const storage = getStorage();
    if (!storage) return {};

    try {
      const raw = storage.getItem(KEY);
      if (raw) return JSON.parse(raw) as Brief;
    } catch (error) {
      void error;
    }
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
    const sanitised: Partial<Brief> = { ...patch };

    if (typeof sanitised.slides === "number") {
      const clamped = Math.max(1, Math.min(10, Math.trunc(sanitised.slides)));
      sanitised.slides = Number.isNaN(clamped) ? undefined : clamped;
    }

    setState((prev) => {
      const next = { ...prev, ...sanitised };
      const storage = getStorage();
      if (storage) {
        try {
          storage.setItem(KEY, JSON.stringify(next));
        } catch (error) {
          void error;
        }
      }
    setState((prev) => {
      const next = { ...prev, ...patch };
      try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState({});
    const storage = getStorage();
    if (storage) {
      try {
        storage.removeItem(KEY);
      } catch (error) {
        void error;
      }
    }
    try { sessionStorage.removeItem(KEY); } catch {}
  }, []);

  const score = useMemo(() => {
    let s = 0;
    if (state.format) s += 15;
    if (state.platform) s += 15;
    if (state.ratio) s += 10;
    if (state.topic && state.topic.trim().length >= 8) s += 30;
    if (state.cta && state.cta.trim()) s += 10;
    if (state.tone) s += 10;
    if (state.format === "carousel") {
      if (typeof state.slides === "number" && state.slides > 0) s += 10;
    } else if (state.format) {
      s += 10;
    }
    if (state.topic && state.topic.length >= 8) s += 30;
    if (state.cta) s += 10;
    if (state.tone) s += 10;
    if (state.slides || state.format !== "carousel") s += 10;
    return Math.min(100, s);
  }, [state]);

  return { state, merge, reset, score };
}
