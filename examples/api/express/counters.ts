// Exemple Express — GET /v1/counters
// À adapter à ton stack (DB client, auth). Conforme à l'API.openapi.yaml.
import type { Request, Response } from 'express';
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

type PlanKey = 'Starter'|'Pro'|'Studio';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const plansPath = path.resolve(process.cwd(), 'config/plans.json');
const plans = JSON.parse(fs.readFileSync(plansPath, 'utf8')) as Record<PlanKey, {
  imagesPerMonth: number; reelsPerMonth: number; woofsIncluded: number;
}>;

function yyyymm(d = new Date()){ return d.getUTCFullYear()*100 + (d.getUTCMonth()+1); }

export async function getCounters(req: Request, res: Response) {
  // Récup du brandId (à remplacer par ta logique auth)
  const brandId = (req as any)?.user?.brandId ?? (req.query.brandId as string);
  if (!brandId) return res.status(400).json({ error: 'brandId missing' });
  const period = yyyymm();
  const client = await pool.connect();
  try {
    const brand = await client.query('SELECT plan FROM brand WHERE id=$1', [brandId]);
    if (!brand.rowCount) return res.status(404).json({ error: 'brand not found' });
    const planKey = brand.rows[0].plan as PlanKey;
    const plan = plans[planKey];
    const counters = await client.query(
      'SELECT images_used, reels_used, woofs_used FROM counters_monthly WHERE brand_id=$1 AND period_yyyymm=$2',
      [brandId, period]
    );
    const row = counters.rows[0] ?? { images_used: 0, reels_used: 0, woofs_used: 0 };
    const totals = { images: plan.imagesPerMonth, reels: plan.reelsPerMonth, woofs: plan.woofsIncluded };
    const pct = {
      images: totals.images ? row.images_used / totals.images : 0,
      reels:  totals.reels  ? row.reels_used  / totals.reels  : 0,
      woofs:  totals.woofs  ? row.woofs_used  / totals.woofs  : 0
    };
    const alert80 = {
      images: Math.floor(pct.images*100) >= 80,
      reels:  Math.floor(pct.reels*100)  >= 80,
      woofs:  totals.woofs > 0 ? Math.floor(pct.woofs*100) >= 80 : false
    };
    return res.json({
      period,
      used: { images: row.images_used, reels: row.reels_used, woofs: row.woofs_used },
      totals, alert80
    });
  } finally { client.release(); }
}

// Exemple de wiring:
// import express from 'express'; const app = express();
// app.get('/v1/counters', getCounters);
// app.listen(process.env.PORT || 3000);
