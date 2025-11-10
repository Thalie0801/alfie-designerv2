import { z } from "zod";

export const generateResponseSyncSchema = z.object({
  imageUrl: z.string().url(),
  assetId: z.string().optional(),
  meta: z.any().optional(),
});

export type GenerateResponseSync = z.infer<typeof generateResponseSyncSchema>;

export const generateResponseAsyncSchema = z.object({
  jobId: z.string(),
});

export type GenerateResponseAsync = z.infer<typeof generateResponseAsyncSchema>;

export const jobStatusSchema = z.object({
  status: z.enum(["queued", "running", "done", "error"]),
  imageUrl: z.string().url().optional(),
  error: z.string().optional(),
});

export type JobStatus = z.infer<typeof jobStatusSchema>;
