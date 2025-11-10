export type Ratio = '1:1' | '9:16' | '16:9' | '3:4';
export type Kind = 'carousel' | 'image' | 'video' | 'text';
export type Language = 'fr' | 'en' | 'es';
export type Goal = 'awareness' | 'lead' | 'sale';
export type Quality = 'fast' | 'high';

export interface AlfieIntent {
  kind: Kind;
  brandId: string;
  campaign?: string;
  language: Language;
  audience?: string;
  goal?: Goal;
  slides?: number;
  ratio?: Ratio;
  templateId?: string;
  copyBrief?: string;
  cta?: string;
  paletteLock?: boolean;
  typographyLock?: boolean;
  assetsRefs?: string[];
  quality?: Quality;
}

export type OrderStatus = 'draft' | 'queued' | 'running' | 'done' | 'error';
export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'retry';
export type JobKind = 'copy' | 'vision' | 'render' | 'upload' | 'thumb' | 'publish';
export type EventLevel = 'debug' | 'info' | 'warn' | 'error';
export type MemoryScope = 'global' | 'user' | 'brand';

export interface Order {
  id: string;
  user_id: string;
  brand_id: string;
  intent_json: AlfieIntent;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  order_id: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempt: number;
  created_at: string;
  updated_at: string;
}

export interface JobEvent {
  id: number;
  job_id: string;
  level: EventLevel;
  message: string;
  meta?: Record<string, unknown>;
  created_at: string;
}

export interface LibraryAsset {
  id: string;
  brand_id: string;
  order_id?: string;
  job_id?: string;
  type: Kind;
  url: string;
  public_id?: string;
  meta?: Record<string, unknown>;
  created_at: string;
}

export interface AlfieMemory {
  id: string;
  scope: MemoryScope;
  user_id?: string;
  brand_id?: string;
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

export interface PlanLimit {
  plan: string;
  max_visuals: number;
  monthly_reset_day: number;
}

export interface Quota {
  id: string;
  user_id: string;
  plan: string;
  period_start: string;
  visuals_used: number;
  messages_used: number;
  updated_at: string;
}

export interface JobPlan {
  kind: JobKind;
  payload: Record<string, unknown>;
}

export interface PlanResponse {
  orderId: string;
  plan: JobPlan[];
  warnings?: string[];
}
