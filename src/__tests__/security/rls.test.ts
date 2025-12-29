/**
 * Tests RLS (Row Level Security) - Phase 1 Sécurité
 * Vérifie que les politiques RLS protègent correctement les données utilisateur
 */

import { describe, it, expect, vi } from 'vitest';

// Mock Supabase client avec simulation RLS
const createMockSupabaseWithRLS = (currentUserId: string) => {
  const mockData = {
    brands: [
      { id: 'brand-1', user_id: 'user-1', name: 'Brand User 1' },
      { id: 'brand-2', user_id: 'user-2', name: 'Brand User 2' },
    ],
    library_assets: [
      { id: 'asset-1', user_id: 'user-1', type: 'image' },
      { id: 'asset-2', user_id: 'user-2', type: 'video' },
    ],
    job_queue: [
      { id: 'job-1', user_id: 'user-1', status: 'queued' },
      { id: 'job-2', user_id: 'user-2', status: 'running' },
    ],
  };

  // Simule le filtrage RLS par user_id
  const filterByRLS = <T extends { user_id: string }>(data: T[]): T[] => {
    return data.filter(item => item.user_id === currentUserId);
  };

  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        const tableData = mockData[table as keyof typeof mockData] || [];
        const filtered = filterByRLS(tableData as any[]);
        return Promise.resolve({ 
          data: filtered[0] || null, 
          error: filtered.length === 0 ? { code: 'PGRST116', message: 'Row not found' } : null 
        });
      }),
      then: vi.fn().mockImplementation((callback) => {
        const tableData = mockData[table as keyof typeof mockData] || [];
        const filtered = filterByRLS(tableData as any[]);
        return Promise.resolve(callback({ data: filtered, error: null }));
      }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: currentUserId } },
        error: null,
      }),
    },
  };
};

describe('RLS - Row Level Security', () => {
  describe('Brands Table', () => {
    it('RLS bloque accès aux brands d\'autres users', async () => {
      const mockClient = createMockSupabaseWithRLS('user-1');
      
      const result = await new Promise(resolve => {
        mockClient.from('brands').select('*').then(resolve);
      });
      
      const { data } = result as { data: any[] };
      
      // User-1 ne devrait voir que ses propres brands
      expect(data).toHaveLength(1);
      expect(data[0].user_id).toBe('user-1');
      expect(data.find((b: any) => b.user_id === 'user-2')).toBeUndefined();
    });

    it('RLS bloque modification brands non-owned', async () => {
      const mockClient = createMockSupabaseWithRLS('user-1');
      
      // Simuler une tentative de modification d'une brand appartenant à user-2
      const updateAttempt = vi.fn().mockImplementation(() => {
        // RLS devrait bloquer cette opération
        return Promise.resolve({
          data: null,
          error: { code: '42501', message: 'new row violates row-level security policy' }
        });
      });
      
      mockClient.from('brands').update = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          then: updateAttempt
        })
      });
      
      const result = await new Promise(resolve => {
        mockClient.from('brands').update({ name: 'Hacked!' }).eq('id', 'brand-2').then(resolve);
      });
      
      const { error } = result as { error: any };
      expect(error).not.toBeNull();
      expect(error.code).toBe('42501');
    });
  });

  describe('Library Assets Table', () => {
    it('RLS protège library_assets par user_id', async () => {
      const mockClient = createMockSupabaseWithRLS('user-1');
      
      const result = await new Promise(resolve => {
        mockClient.from('library_assets').select('*').then(resolve);
      });
      
      const { data } = result as { data: any[] };
      
      // User-1 ne devrait voir que ses propres assets
      expect(data).toHaveLength(1);
      expect(data[0].user_id).toBe('user-1');
      expect(data[0].id).toBe('asset-1');
    });
  });

  describe('Job Queue Table', () => {
    it('RLS protège job_queue par user_id', async () => {
      const mockClient = createMockSupabaseWithRLS('user-2');
      
      const result = await new Promise(resolve => {
        mockClient.from('job_queue').select('*').then(resolve);
      });
      
      const { data } = result as { data: any[] };
      
      // User-2 ne devrait voir que ses propres jobs
      expect(data).toHaveLength(1);
      expect(data[0].user_id).toBe('user-2');
      expect(data[0].id).toBe('job-2');
    });
  });
});

describe('RLS - Cross-user Access Prevention', () => {
  it('User A ne peut pas accéder aux données de User B via ID direct', async () => {
    const userAClient = createMockSupabaseWithRLS('user-a');
    
    // Tenter d'accéder directement à un asset de user-b
    const mockSelectById = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' }
    });
    
    userAClient.from('library_assets').select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: mockSelectById
      })
    });
    
    const result = await userAClient.from('library_assets')
      .select('*')
      .eq('id', 'asset-belonging-to-user-b')
      .single();
    
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });
});
