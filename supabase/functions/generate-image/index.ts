// deno-lint-ignore-file no-explicit-any
// supabase/functions/generate-image/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE")!;
const BUCKET = "library"; // adapte à ton bucket

type Body = {
  prompt: string;
  aspectRatio?: "1:1" | "9:16" | "16:9" | "3:4";
  count?: number;        // 1-4
  userId?: string;       // pour ranger par user
  seed?: number | null;
};

const MODEL = "imagen-3.0-generate-001"; // modèle images Gemini (AI Studio)

function mapAspectRatio(ar: Body["aspectRatio"]): { width: number; height: number } {
  switch (ar) {
    case "9:16":  return { width: 1024, height: 1820 };
    case "16:9":  return { width: 1820, height: 1024 };
    case "3:4":   return { width: 1152, height: 1536 };
    case "1:1":
    default:      return { width: 1024, height: 1024 };
  }
}

function b64ToUint8Array(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = (await req.json()) as Body;
    if (!body?.prompt) {
      return Response.json({ error: "prompt requis" }, { status: 400 });
    }
    const { width, height } = mapAspectRatio(body.aspectRatio);
    const count = Math.max(1, Math.min(body.count ?? 1, 4));
    const seed = body.seed ?? null;

    // --- 1) Appel Gemini Images API (AI Studio) ---
    // https://ai.google.dev/gemini-api/docs/image-generation
    const gen = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/images:generate?key=" + encodeURIComponent(GEMINI_API_KEY),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // note: "model" attendu côté images.generate
          model: MODEL,
          // Le prompt principal
          prompt: {
            text: body.prompt,
          },
          // Paramétrage image
          imageGenerationConfig: {
            numberOfImages: count,
            // Dimensions approximées ; certaines implémentations acceptent "aspectRatio"
            // ici on pousse width/height (les docs tolèrent différentes clés selon version)
            width,
            height,
            seed,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_SEXUAL", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          ],
        }),
      }
    );

    if (!gen.ok) {
      const t = await gen.text();
      return Response.json({ error: `Gemini error ${gen.status}: ${t}` }, { status: 502 });
    }

    const genJson = await gen.json();
    // Réponse: images[] base64
    const images: string[] =
      genJson?.images?.map((img: any) => img?.image?.base64) ??
      genJson?.candidates?.flatMap((c: any) => (c?.content?.parts ?? [])
          .filter((p: any) => p?.inlineData?.data)
          .map((p: any) => p.inlineData.data)) ??
      [];

    if (!images.length) {
      return Response.json({ error: "Aucune image retournée" }, { status: 502 });
    }

    // --- 2) Upload Supabase Storage ---
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const userId = body.userId || "anonymous";
    const paths: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const pngBytes = b64ToUint8Array(images[i]);
      const fileName = `${crypto.randomUUID()}.png`;
      const path = `images/${userId}/${y}/${m}/${fileName}`;

      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: "PUT",
        headers: {
          "Content-Type": "image/png",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE}`,
          "x-upsert": "true",
        },
        body: pngBytes,
      });
      if (!up.ok) {
        const tt = await up.text();
        return Response.json({ error: `Upload error: ${up.status} ${tt}` }, { status: 500 });
      }
      paths.push(path);
    }

    // URL publique (si bucket public) sinon signe une URL
    const publicBase = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
    const urls = paths.map((p) => publicBase + encodeURI(p));

    return Response.json({
      ok: true,
      model: MODEL,
      count: images.length,
      width,
      height,
      urls,
    });
  } catch (e) {
    return Response.json({ error: e?.message || "Erreur inconnue" }, { status: 500 });
  }
});
