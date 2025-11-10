import type { AlfieIntent, EventLevel, JobKind, JobStatus, Kind, OrderStatus, Quota } from '@/lib/types/alfie';

export type OrderRow = {
  id: string;
  user_id: string;
  brand_id: string;
  intent_json: AlfieIntent;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
};

export type JobRow = {
  id: string;
  order_id: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempt: number;
  created_at: string;
  updated_at: string;
};

export type JobEventRow = {
  id: number;
  job_id: string;
  level: EventLevel;
  message: string;
  meta?: Record<string, unknown>;
  created_at: string;
};

export type LibraryAssetRow = {
  id: string;
  brand_id: string;
  order_id?: string;
  job_id?: string;
  type: Kind;
  url: string;
  public_id?: string;
  meta?: Record<string, unknown>;
  created_at: string;
};

export type QuotaRow = Quota;
