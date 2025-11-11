import { randomUUID } from "node:crypto";
import type { HostId } from "./context";

export type SessionState = {
  id: string;
  host: HostId;
  brandId: string;
  userId?: string;
  nudges?: Record<string, boolean>;
  lastDeliverableId?: string;
  data?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

const mem = new Map<string, SessionState>();
const TTL_MS = 1000 * 60 * 60 * 24; // 24h

function prune() {
  const now = Date.now();
  for (const [k, s] of mem) {
    if (now - s.updatedAt > TTL_MS) mem.delete(k);
  }
}

export function createSession(host: HostId, brandId: string, userId?: string) {
  prune();
  const id = randomUUID();
  const s: SessionState = {
    id,
    host,
    brandId,
    userId,
    nudges: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  mem.set(id, s);
  return s;
}

export function getSession(id: string) {
  prune();
  const s = mem.get(id);
  if (!s) return null;
  return s;
}

export function saveSession(s: SessionState) {
  s.updatedAt = Date.now();
  mem.set(s.id, s);
}
