/**
 * Brevo API Helper
 * Documentation: https://developers.brevo.com/reference
 */

const BREVO_API_URL = "https://api.brevo.com/v3";

export interface BrevoEmailRecipient {
  email: string;
  name?: string;
}

export interface BrevoSender {
  name: string;
  email: string;
}

export interface SendTransactionalEmailParams {
  to: BrevoEmailRecipient[];
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  sender?: BrevoSender;
  replyTo?: BrevoEmailRecipient;
  templateId?: number;
  params?: Record<string, unknown>;
  tags?: string[];
}

export interface BrevoContactParams {
  email: string;
  attributes?: Record<string, unknown>;
  listIds?: number[];
  updateEnabled?: boolean;
  emailBlacklisted?: boolean;
  smsBlacklisted?: boolean;
}

export interface BrevoList {
  id: number;
  name: string;
  totalBlacklisted: number;
  totalSubscribers: number;
  folderId: number;
}

function getApiKey(): string {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }
  return apiKey;
}

function getHeaders(): HeadersInit {
  return {
    "api-key": getApiKey(),
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Send a transactional email via Brevo
 */
export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams
): Promise<{ messageId: string }> {
  const {
    to,
    subject,
    htmlContent,
    textContent,
    sender,
    replyTo,
    templateId,
    params: emailParams,
    tags,
  } = params;

  // Either templateId OR (subject + content) must be provided
  if (!templateId && !subject) {
    throw new Error("Either templateId or subject must be provided");
  }

  const body: Record<string, unknown> = {
    to,
  };

  if (templateId) {
    body.templateId = templateId;
  } else {
    body.subject = subject;
    if (htmlContent) body.htmlContent = htmlContent;
    if (textContent) body.textContent = textContent;
  }

  if (sender) {
    body.sender = sender;
  } else {
    // Default sender - update with your verified domain
    body.sender = { name: "Alfie", email: "noreply@alfiedesigner.com" };
  }

  if (replyTo) body.replyTo = replyTo;
  if (emailParams) body.params = emailParams;
  if (tags) body.tags = tags;

  console.log("[brevo] Sending transactional email to:", to.map(r => r.email).join(", "));

  const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[brevo] Email send failed:", response.status, errorText);
    throw new Error(`Brevo email failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("[brevo] Email sent successfully, messageId:", result.messageId);
  return { messageId: result.messageId };
}

/**
 * Create or update a contact in Brevo
 */
export async function createOrUpdateContact(
  params: BrevoContactParams
): Promise<{ id?: number; created: boolean }> {
  const {
    email,
    attributes = {},
    listIds = [],
    updateEnabled = true,
    emailBlacklisted = false,
    smsBlacklisted = false,
  } = params;

  console.log("[brevo] Creating/updating contact:", email);

  const body: Record<string, unknown> = {
    email,
    attributes,
    updateEnabled,
    emailBlacklisted,
    smsBlacklisted,
  };

  if (listIds.length > 0) {
    body.listIds = listIds;
  }

  const response = await fetch(`${BREVO_API_URL}/contacts`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  // 201 = created, 204 = updated (when updateEnabled=true)
  if (response.status === 201) {
    const result = await response.json();
    console.log("[brevo] Contact created, id:", result.id);
    return { id: result.id, created: true };
  }

  if (response.status === 204) {
    console.log("[brevo] Contact updated:", email);
    return { created: false };
  }

  // Handle duplicate contact error (already exists)
  if (response.status === 400) {
    const errorData = await response.json();
    if (errorData.code === "duplicate_parameter") {
      console.log("[brevo] Contact already exists, updating:", email);
      return { created: false };
    }
    throw new Error(`Brevo contact error: ${JSON.stringify(errorData)}`);
  }

  const errorText = await response.text();
  console.error("[brevo] Contact create/update failed:", response.status, errorText);
  throw new Error(`Brevo contact failed: ${response.status} - ${errorText}`);
}

/**
 * Add a contact to specific lists
 */
export async function addContactToLists(
  email: string,
  listIds: number[]
): Promise<void> {
  if (listIds.length === 0) return;

  console.log("[brevo] Adding contact to lists:", email, listIds);

  // We need to add to each list individually
  for (const listId of listIds) {
    const response = await fetch(`${BREVO_API_URL}/contacts/lists/${listId}/contacts/add`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ emails: [email] }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[brevo] Failed to add to list ${listId}:`, errorText);
      // Continue with other lists even if one fails
    } else {
      console.log(`[brevo] Added ${email} to list ${listId}`);
    }
  }
}

/**
 * Remove a contact from specific lists
 */
export async function removeContactFromLists(
  email: string,
  listIds: number[]
): Promise<void> {
  if (listIds.length === 0) return;

  console.log("[brevo] Removing contact from lists:", email, listIds);

  for (const listId of listIds) {
    const response = await fetch(`${BREVO_API_URL}/contacts/lists/${listId}/contacts/remove`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ emails: [email] }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[brevo] Failed to remove from list ${listId}:`, errorText);
    } else {
      console.log(`[brevo] Removed ${email} from list ${listId}`);
    }
  }
}

/**
 * Get all lists
 */
export async function getLists(limit = 50, offset = 0): Promise<{ lists: BrevoList[]; count: number }> {
  console.log("[brevo] Fetching lists");

  const response = await fetch(`${BREVO_API_URL}/contacts/lists?limit=${limit}&offset=${offset}`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[brevo] Failed to get lists:", errorText);
    throw new Error(`Brevo get lists failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return { lists: result.lists || [], count: result.count || 0 };
}

/**
 * Create a new list
 */
export async function createList(name: string, folderId = 1): Promise<{ id: number }> {
  console.log("[brevo] Creating list:", name);

  const response = await fetch(`${BREVO_API_URL}/contacts/lists`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ name, folderId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[brevo] Failed to create list:", errorText);
    throw new Error(`Brevo create list failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log("[brevo] List created, id:", result.id);
  return { id: result.id };
}

/**
 * Get contact info by email
 */
export async function getContact(email: string): Promise<Record<string, unknown> | null> {
  console.log("[brevo] Getting contact:", email);

  const response = await fetch(`${BREVO_API_URL}/contacts/${encodeURIComponent(email)}`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[brevo] Failed to get contact:", errorText);
    throw new Error(`Brevo get contact failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}
