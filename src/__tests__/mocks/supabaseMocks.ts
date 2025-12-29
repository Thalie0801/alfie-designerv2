/**
 * Mocks Supabase pour les tests unitaires
 */

import { vi } from 'vitest';

// Mock de réponse Supabase standard
export const createMockSupabaseResponse = <T>(data: T, error: any = null) => ({
  data,
  error,
});

// Mock du client Supabase
export const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
};

// Brand Kit mock complet
export const mockBrandKit = {
  id: 'brand-123',
  name: 'Test Brand',
  niche: 'coach-consultant',
  voice: 'Professionnel mais accessible',
  palette: {
    primary: '#90E3C2',
    secondary: '#1F2937',
    accent: '#F59E0B',
    background: '#FFFFFF',
    text: '#111827',
  },
  fonts: {
    heading: 'Montserrat',
    body: 'Open Sans',
  },
  logo_url: 'https://example.com/logo.png',
  text_color: '#FFFFFF',
  visual_types: ['3d_illustration', 'photorealistic'],
  visual_mood: ['minimaliste', 'lumineux'],
  avoid_in_visuals: 'texte trop chargé',
  adjectives: ['innovant', 'accessible', 'premium'],
  pitch: 'Accompagnement entrepreneurial sur mesure',
  tagline: 'Votre succès, notre mission',
  tone_sliders: {
    fun_serious: 70,
    accessible_corporate: 50,
    energetic_calm: 40,
    direct_nuanced: 60,
  },
  person: 'nous',
  language_level: 'courant',
  quota_woofs: 450,
  woofs_used: 50,
};

// User profile mock
export const mockUserProfile = {
  id: 'user-123',
  email: 'test@example.com',
  full_name: 'Test User',
  plan: 'pro',
  active_brand_id: 'brand-123',
  woofs_consumed_this_month: 50,
};

// Reset all mocks
export function resetMocks() {
  vi.clearAllMocks();
  mockSupabaseClient.from.mockReturnThis();
  mockSupabaseClient.select.mockReturnThis();
  mockSupabaseClient.insert.mockReturnThis();
  mockSupabaseClient.update.mockReturnThis();
  mockSupabaseClient.delete.mockReturnThis();
  mockSupabaseClient.eq.mockReturnThis();
}
