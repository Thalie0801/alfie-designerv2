// src/integrations/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[Alfie] Supabase mal configuré côté client – certaines fonctionnalités ne marcheront pas.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
ABASE_ANON_KEY);
