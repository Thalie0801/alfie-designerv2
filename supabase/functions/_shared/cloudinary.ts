import { v2 as cloudinary } from "npm:cloudinary";

const processEnv = (globalThis as any)?.process?.env ?? {};
const cloudName = (typeof Deno !== "undefined" ? Deno.env.get("CLOUDINARY_CLOUD_NAME") : undefined) ??
  processEnv.CLOUDINARY_CLOUD_NAME;
const apiKey = (typeof Deno !== "undefined" ? Deno.env.get("CLOUDINARY_API_KEY") : undefined) ??
  processEnv.CLOUDINARY_API_KEY;
const apiSecret = (typeof Deno !== "undefined" ? Deno.env.get("CLOUDINARY_API_SECRET") : undefined) ??
  processEnv.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error("Missing Cloudinary configuration");
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
});

export async function uploadToCloudinary(input: {
  file: string;
  folder: string;
  context?: Record<string, string>;
  tags?: string[];
}) {
  const res = await cloudinary.uploader.upload(input.file, {
    folder: input.folder,
    context: input.context,
    tags: input.tags,
    resource_type: "image",
  });
  if (!res?.secure_url) throw new Error("Upload Cloudinary sans secure_url");
  return { url: res.secure_url, publicId: res.public_id };
}
