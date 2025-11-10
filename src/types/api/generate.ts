import { z } from "zod";

export const GenerateResponseSync = z.object({
  imageUrl: z.string().url(),
  assetId: z.string().optional(),
  meta: z.any().optional(),
});

export type GenerateResponseSync = z.infer<typeof GenerateResponseSync>;

export const GenerateResponseAsync = z.object({
  jobId: z.string(),
});

export type GenerateResponseAsync = z.infer<typeof GenerateResponseAsync>;

export const JobStatus = z.object({
  status: z.enum(["queued", "running", "done", "error"]),
  imageUrl: z.string().url().optional(),
  error: z.string().optional(),
});

export type JobStatus = z.infer<typeof JobStatus>;
