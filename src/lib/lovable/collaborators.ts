const EDGE_BASE = import.meta.env.VITE_EDGE_BASE_URL;

function assertEdgeBase(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("VITE_EDGE_BASE_URL manquant (Lovable Edge Function base URL)");
  }
}

function getEdgeBase(): string {
  assertEdgeBase(EDGE_BASE);
  return EDGE_BASE;
}

export function buildLovableProjectUrl(projectId: string, path: string) {
  if (!projectId) {
    throw new Error("Missing projectId before calling collaborators API");
  }

  const base = getEdgeBase();
  const normalizedPath = (path.startsWith("/") ? path : `/${path}`).replace(/\/{2,}/g, "/");
  return `${base}/lovable-proxy/projects/${encodeURIComponent(projectId)}${normalizedPath}`;
}

async function handleLovableResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Collaborators API failed: ${response.status} ${response.statusText} — ${text}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export async function listProjectCollaborators<T = unknown>(
  projectId: string,
): Promise<T> {
  const url = buildLovableProjectUrl(projectId, "/collaborators");
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return handleLovableResponse<T>(response);
}

export async function inviteProjectCollaborator<T = unknown>(
  projectId: string,
  email: string,
): Promise<T> {
  if (!email) {
    throw new Error("Email is required to invite a collaborator");
  }

  const url = buildLovableProjectUrl(projectId, "/collaborators");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  return handleLovableResponse<T>(response);
}
