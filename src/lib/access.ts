const env = (import.meta.env ?? {}) as Record<string, string | undefined>;

const resolveEnvValue = (key: string): string | undefined => {
  const normalizedKey = key.toUpperCase();
  return (
    env[normalizedKey] ??
    env[`VITE_${normalizedKey}`] ??
    env[`PUBLIC_${normalizedKey}`] ??
    env[`NEXT_PUBLIC_${normalizedKey}`]
  );
};

export const list = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

export const VIPS = list(resolveEnvValue('VIP_EMAILS'));
export const ADMINS = list(resolveEnvValue('ADMIN_EMAILS'));

const normalizeEmail = (email?: string | null) => (email ?? '').trim().toLowerCase();

export const isVip = (email?: string | null) => {
  const normalized = normalizeEmail(email);
  return Boolean(normalized) && VIPS.includes(normalized);
};

export const isAdmin = (email?: string | null) => {
  const normalized = normalizeEmail(email);
  return Boolean(normalized) && ADMINS.includes(normalized);
};

export const isVipOrAdmin = (email?: string | null) => isVip(email) || isAdmin(email);

export { normalizeEmail };
