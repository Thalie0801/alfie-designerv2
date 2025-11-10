const STUDIO_PATH = import.meta.env.VITE_STUDIO_URL || "/studio";
const LIBRARY_PATH = import.meta.env.VITE_LIBRARY_URL || "/library";

function withOrder(path: string, orderId?: string | null): string {
  if (!orderId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}order=${encodeURIComponent(orderId)}`;
}

export function studioLink(orderId?: string | null): string {
  return withOrder(STUDIO_PATH, orderId);
}

export function libraryLink(orderId?: string | null): string {
  return withOrder(LIBRARY_PATH, orderId);
}
