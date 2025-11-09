export type ParsedBrief = {
  ratio: "1:1" | "9:16" | "16:9" | "3:4";
  images: number;
  carousels: number;
  slidesPerCarousel: number;
  videos: number;
  cta?: string;
  tone?: "pro" | "fun" | "friendly" | "luxury" | "urgent";
  topics: string[];
};

const RATIO_RE = /\b(1:1|9:16|16:9|3:4)\b/i;
const NUM_RE = /(\d+)\s*(images?|carrousels?|carousels?|vidéos?)/gi;
const CAR_RE = /(\d+)\s*(?:carrousels?|carousels?)\s*(?:x|×)\s*(\d+)\s*(?:slides?|diapos?)/i;
const CTA_RE = /\b(?:cta|appel(?:\s+à\s+l[’']?action)?)\s*:\s*["“](.+?)["”]/i;
const TONE_RE = /\b(pro|professionnel|fun|amusa[nt]|friendly|convivial|luxe|luxury|urgent)\b/i;

const DEFAULT: ParsedBrief = {
  ratio: "1:1",
  images: 1,
  carousels: 0,
  slidesPerCarousel: 5,
  videos: 0,
  topics: [],
};

export function parsePrompt(input: string): ParsedBrief {
  const text = (input || "").trim();
  if (!text) return { ...DEFAULT };

  const p: ParsedBrief = { ...DEFAULT };

  const r = text.match(RATIO_RE);
  if (r) p.ratio = r[1] as ParsedBrief["ratio"];

  const car = text.match(CAR_RE);
  if (car) {
    p.carousels = Math.max(1, parseInt(car[1], 10));
    p.slidesPerCarousel = Math.max(1, parseInt(car[2], 10));
  }

  let m: RegExpExecArray | null;
  const counts = { image: 0, carousel: 0, video: 0 };
  const singularize = (w: string) => w.toLowerCase().replace(/s$/, "");
  while ((m = NUM_RE.exec(text))) {
    const n = parseInt(m[1], 10);
    const kind = singularize(m[2]);
    if (kind.startsWith("image")) counts.image += n;
    else if (kind.startsWith("carou")) counts.carousel += n;
    else if (kind.startsWith("vidéo") || kind.startsWith("video")) counts.video += n;
  }
  if (!car && counts.carousel > 0) p.carousels = counts.carousel;
  if (counts.image > 0) p.images = counts.image;
  if (counts.video > 0) p.videos = counts.video;

  const cta = text.match(CTA_RE);
  if (cta) p.cta = cta[1].trim();

  const t = text.match(TONE_RE);
  if (t) {
    const k = t[1].toLowerCase();
    if (k.startsWith("pro")) p.tone = "pro";
    else if (k.startsWith("fun") || k.startsWith("amusa")) p.tone = "fun";
    else if (k.startsWith("friend") || k.startsWith("convi")) p.tone = "friendly";
    else if (k.startsWith("lux")) p.tone = "luxury";
    else if (k.startsWith("urgent")) p.tone = "urgent";
  }

  p.topics = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 3 &&
        !/^(avec|pour|dans|les|des|une|que|est|sur|vos?|notre|leur|plus|tout|afin|chez)$/.test(w),
    )
    .slice(0, 6);

  return p;
}

export function toGeneratePayload(brandId: string, prompt: string) {
  const b = parsePrompt(prompt);
  return {
    brandId,
    prompt,
    ratio: b.ratio,
    images: { count: b.images, mode: "image" as const },
    carousels: {
      count: b.carousels,
      slidesPerCarousel: b.slidesPerCarousel,
      mode: "carousel" as const,
    },
    videos: { count: b.videos, mode: "video" as const },
    meta: { cta: b.cta, tone: b.tone, topics: b.topics },
  };
}
