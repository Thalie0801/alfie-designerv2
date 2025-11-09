const LOVABLE_API_ORIGIN = "https://api.lovable.dev";

export function buildLovableProjectUrl(projectId: string, path: string) {
  if (!projectId) {
    throw new Error("Missing projectId before calling collaborators API");
  }

  const normalizedPath = (path.startsWith("/") ? path : `/${path}`).replace(/\/{2,}/g, "/");
  return `${LOVABLE_API_ORIGIN}/projects/${encodeURIComponent(projectId)}${normalizedPath}`;
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
  lovableToken: string,
): Promise<T> {
  const url = buildLovableProjectUrl(projectId, "/collaborators");
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${lovableToken}`,
    },
  });

  return handleLovableResponse<T>(response);
}

export async function inviteProjectCollaborator<T = unknown>(
  projectId: string,
  lovableToken: string,
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
      Authorization: `Bearer ${lovableToken}`,
    },
    body: JSON.stringify({ email }),
  });

  return handleLovableResponse<T>(response);
}
