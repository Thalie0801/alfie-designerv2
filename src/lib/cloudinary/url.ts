const UPLOAD_SEGMENT = "/upload/";

function parseCloudinaryUrl(url?: string | null) {
  if (!url) return null;
  const uploadIndex = url.indexOf(UPLOAD_SEGMENT);
  if (uploadIndex === -1) return null;

  const base = url.slice(0, uploadIndex + UPLOAD_SEGMENT.length);
  const restWithQuery = url.slice(uploadIndex + UPLOAD_SEGMENT.length);
  const [rest, query] = restWithQuery.split("?");
  const segments = rest.split("/").filter((segment) => segment.length > 0);

  if (segments.length === 0) return { base, segments, query, original: url };
  return { base, segments, query, original: url };
}

function buildCloudinaryUrl(base: string, segments: string[], query?: string) {
  const path = segments.join("/");
  return `${base}${path}${query ? `?${query}` : ""}`;
}

function isVersionSegment(segment: string | undefined) {
  return Boolean(segment && /^v\d+$/i.test(segment));
}

function ensureTransforms(initial: string[], required: string[]): string[] {
  const transforms = [...initial];
  for (let i = required.length - 1; i >= 0; i -= 1) {
    const t = required[i];
    if (!transforms.includes(t)) {
      transforms.unshift(t);
    }
  }
  return transforms;
}

export function toOriginalUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) return url;

  const { base, segments, query } = parsed;
  if (segments.length === 0) return url;

  if (isVersionSegment(segments[0])) {
    return buildCloudinaryUrl(base, segments, query);
  }

  return buildCloudinaryUrl(base, segments.slice(1), query);
}

export function toThumbUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const parsed = parseCloudinaryUrl(url);
  if (!parsed) return url;

  const { base, segments, query } = parsed;
  if (segments.length === 0) return url;

  const desired = ["f_auto", "q_auto", "w_800", "c_fill"];
  const [first, ...rest] = segments;

  if (isVersionSegment(first)) {
    const transform = desired.join(",");
    return buildCloudinaryUrl(base, [transform, first, ...rest], query);
  }

  const existing = first.split(",").map((part) => part.trim()).filter(Boolean);
  const transforms = ensureTransforms(existing, desired);
  const newFirst = Array.from(new Set(transforms));

  return buildCloudinaryUrl(base, [newFirst.join(","), ...rest], query);
}

function appendDownloadParam(url: string): string {
  return url.includes("?") ? `${url}&download=1` : `${url}?download=1`;
}

export function toDownloadUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const original = toOriginalUrl(url);
  if (!original) return undefined;

  const parsed = parseCloudinaryUrl(original);
  if (!parsed) return appendDownloadParam(original);

  const { base, segments, query } = parsed;
  if (segments.length === 0) return appendDownloadParam(original);

  const [first, ...rest] = segments;
  if (isVersionSegment(first)) {
    return buildCloudinaryUrl(base, ["fl_attachment", first, ...rest], query);
  }

  const existing = first.split(",").map((part) => part.trim()).filter(Boolean);
  if (!existing.includes("fl_attachment")) {
    existing.unshift("fl_attachment");
  }

  return buildCloudinaryUrl(base, [existing.join(","), ...rest], query);
}
