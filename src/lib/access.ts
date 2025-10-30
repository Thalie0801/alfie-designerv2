// Hardcoded VIP and Admin emails for guaranteed client-side recognition
const HARDCODED_VIPS = 'borderonpatricia7@gmail.com,sandrine.guedra54@gmail.com';
const HARDCODED_ADMINS = 'nathaliestaelens@gmail.com';

export const list = (value?: string) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

export const VIPS = list(HARDCODED_VIPS);
export const ADMINS = list(HARDCODED_ADMINS);

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
