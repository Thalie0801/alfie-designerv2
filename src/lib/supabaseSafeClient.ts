import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const authConfig: SupabaseClientOptions<Database>['auth'] =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
    ? {
        storage: window.localStorage,
        persistSession: true,
        autoRefreshToken: true,
      }
    : undefined;

const clientOptions: SupabaseClientOptions<Database> | undefined = authConfig
  ? { auth: authConfig }
  : undefined;

type DatabaseClient = SupabaseClient<Database>;

function createMissingEnvProxy(): DatabaseClient {
  const err = new Error(
    'Supabase non configuré côté frontend. Définir VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY), puis republier.'
  );

  const handler: ProxyHandler<any> = {
    get() {
      throw err;
    },
    apply() {
      throw err;
    },
  };

  return new Proxy(() => undefined, handler) as unknown as DatabaseClient;
}

export const supabase: DatabaseClient =
  URL && KEY
    ? createClient<Database>(URL, KEY, clientOptions)
    : createMissingEnvProxy();
