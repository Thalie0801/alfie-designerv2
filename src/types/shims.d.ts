declare module "lodash" {
  export type DebouncedFunc<T extends (...args: any[]) => any> = {
    (...args: Parameters<T>): ReturnType<T>;
    cancel(): void;
    flush(): ReturnType<T>;
    pending(): boolean;
  };

  export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: { leading?: boolean; trailing?: boolean; maxWait?: number },
  ): DebouncedFunc<T>;

  const lodash: {
    debounce: typeof debounce;
  } & Record<string, unknown>;

  export default lodash;
}

// Cloudinary global (si jamais référencé)
interface Window { cloudinary?: unknown; }

// Vite env
interface ImportMetaEnv {
  readonly VITE_STUDIO_URL?: string;
  readonly VITE_LIBRARY_URL?: string;
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_EDGE_BASE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
