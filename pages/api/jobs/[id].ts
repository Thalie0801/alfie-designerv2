import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!,
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (req.method !== "GET") return res.status(405).json({ message: "Method not allowed" });
  if (!id || typeof id !== "string") return res.status(400).json({ message: "jobId requis" });

  const { data, error } = await supabase
    .from("job_queue")
    .select("status, output_url, error_text")
    .eq("id", id)
    .single();

  if (error) return res.status(500).json({ message: error.message });
  if (!data) return res.status(404).json({ message: "Job introuvable" });

  const body: { status: string; imageUrl?: string; error?: string } = {
    status: data.status,
  };
  if (data.output_url) body.imageUrl = data.output_url;
  if (data.error_text) body.error = data.error_text;

  res.status(200).json(body);
}
