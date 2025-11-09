import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./env.ts";

const admin = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<{ ref: string; data: T }>
): Promise<T> {
  // 1. Essayer d'insérer la clé
  const { data: inserted, error: insertErr } = await admin
    .from('idempotency_keys')
    .insert({ key, status: 'pending' })
    .select()
    .maybeSingle();

  if (insertErr) {
    // Clé déjà existante → vérifier son statut
    const { data: existing } = await admin
      .from('idempotency_keys')
      .select('*')
      .eq('key', key)
      .single();

    if (existing?.status === 'applied') {
      // Déjà traité → charger le résultat
      console.log(`[Idempotency] Key ${key} already applied, returning cached result`);
      
      // Parse result_ref (ex: "job_set:uuid")
      const [type, id] = existing.result_ref.split(':');
      if (type === 'job_set') {
        const { data: jobSet } = await admin
          .from('job_sets')
          .select('*')
          .eq('id', id)
          .single();
        return jobSet as T;
      }
      
      throw new Error('Unknown result_ref format');
    }

    if (existing?.status === 'pending') {
      throw new Error('REQUEST_IN_PROGRESS');
    }

    throw new Error('IDEMPOTENCY_ERROR');
  }

  // 2. Exécuter la fonction métier
  try {
    const result = await fn();
    
    // 3. Marquer comme appliqué
    await admin
      .from('idempotency_keys')
      .update({ status: 'applied', result_ref: result.ref })
      .eq('key', key);
    
    return result.data;
  } catch (err) {
    // 4. Marquer comme échoué
    await admin
      .from('idempotency_keys')
      .update({ status: 'failed' })
      .eq('key', key);
    
    throw err;
  }
}
