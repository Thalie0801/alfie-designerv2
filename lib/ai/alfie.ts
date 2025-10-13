export type AgentMessageRole = "system" | "user" | "assistant";

export interface AgentMessage {
  role: AgentMessageRole;
  content: string;
}

interface RespondOptions {
  messages: AgentMessage[];
  systemInstruction?: string;
}

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash-exp";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_HOST = process.env.GEMINI_API_HOST ?? "https://generativelanguage.googleapis.com";

function mapRoleToGemini(role: AgentMessageRole) {
  return role === "assistant" ? "model" : role === "system" ? "user" : "user";
}

async function callGemini(payload: any) {
  if (!GEMINI_API_KEY) {
    return {
      text: "Gemini n'est pas disponible pour le moment (clé API manquante).",
    };
  }

  const url = `${GEMINI_API_HOST}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return { text: "Je n'ai pas réussi à générer une réponse pour le moment." };
  }

  const text = parts.map((part: any) => part?.text ?? "").join("");
  return { text: text || "Je n'ai pas réussi à générer une réponse pour le moment." };
}

export async function respond({ messages, systemInstruction }: RespondOptions) {
  const contents = messages
    .filter(message => message.role !== "system")
    .filter(message => message.content.trim().length > 0)
    .map(message => ({
      role: mapRoleToGemini(message.role),
      parts: [{ text: message.content }],
    }));

  const payload: any = {
    contents,
    generationConfig: {
      temperature: 0.85,
      topK: 40,
      topP: 0.95,
    },
  };

  if (systemInstruction && systemInstruction.trim().length > 0) {
    payload.systemInstruction = {
      role: "system",
      parts: [{ text: systemInstruction }],
    };
  }

  const { text } = await callGemini(payload);
  return text;
}

export async function respondStream({ messages, systemInstruction }: RespondOptions) {
  const fullText = await respond({ messages, systemInstruction });

  async function* streamChunks() {
    if (!fullText) {
      return;
    }

    const chunkSize = 160;
    for (let index = 0; index < fullText.length; index += chunkSize) {
      const chunk = fullText.slice(index, Math.min(fullText.length, index + chunkSize));
      yield chunk;
    }
  }

  return streamChunks();
}
