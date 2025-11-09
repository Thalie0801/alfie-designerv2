export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];
export type Dict<T = unknown> = Record<string, T>;
export type ID = string & { readonly __brand: "id" };
export type ISODate = string & { readonly __brand: "iso-date" };

export interface LibraryAsset {
  id: ID;
  type: "image" | "carousel" | "video" | string;
  url?: string | null;
  coverUrl?: string | null;
  slideUrls?: string[] | null;
  ratio?: "1:1" | "9:16" | "16:9" | "3:4" | string;
  title?: string | null;
  created_at?: ISODate | null;
  meta?: Dict<Json> | null;
}

export interface JobRow {
  id: ID;
  order_id?: ID;
  type: string;
  status: "queued" | "running" | "done" | "error" | string;
  output_url?: string | null;
  error_text?: string | null;
  created_at?: ISODate | null;
}
