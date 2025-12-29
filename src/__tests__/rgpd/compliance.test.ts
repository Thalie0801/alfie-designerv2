/**
 * Tests RGPD Compliance - Phase 3 UX & Features
 * Vérifie la conformité au règlement général sur la protection des données
 */

import { describe, it, expect } from 'vitest';

// Types pour RGPD
interface UserData {
  profile: {
    id: string;
    email: string;
    full_name: string;
    plan: string;
  };
  brands: Array<{ id: string; name: string }>;
  assets: Array<{ id: string; type: string }>;
  jobs: Array<{ id: string; status: string }>;
  generations: Array<{ id: string; prompt: string }>;
}

// Mock de la base de données
let mockProfiles: Array<{ id: string; email: string; full_name: string; plan: string }> = [];
let mockBrands: Array<{ id: string; user_id: string; name: string }> = [];
let mockAssets: Array<{ id: string; user_id: string; type: string }> = [];
let mockJobs: Array<{ id: string; user_id: string; status: string }> = [];
let mockGenerations: Array<{ id: string; user_id: string; prompt: string }> = [];
let mockAnonymizedLogs: Array<{ id: string; user_id: string | null; action: string }> = [];

// Service RGPD simulé
const rgpdService = {
  exportUserData: (userId: string): UserData | null => {
    const profile = mockProfiles.find(p => p.id === userId);
    if (!profile) return null;

    return {
      profile,
      brands: mockBrands.filter(b => b.user_id === userId),
      assets: mockAssets.filter(a => a.user_id === userId),
      jobs: mockJobs.filter(j => j.user_id === userId),
      generations: mockGenerations.filter(g => g.user_id === userId),
    };
  },

  deleteUserAccount: (userId: string): { success: boolean; deletedCounts: Record<string, number> } => {
    const profile = mockProfiles.find(p => p.id === userId);
    if (!profile) {
      return { success: false, deletedCounts: {} };
    }

    const deletedCounts = {
      brands: mockBrands.filter(b => b.user_id === userId).length,
      assets: mockAssets.filter(a => a.user_id === userId).length,
      jobs: mockJobs.filter(j => j.user_id === userId).length,
      generations: mockGenerations.filter(g => g.user_id === userId).length,
    };

    // Cascade delete
    mockBrands = mockBrands.filter(b => b.user_id !== userId);
    mockAssets = mockAssets.filter(a => a.user_id !== userId);
    mockJobs = mockJobs.filter(j => j.user_id !== userId);
    mockGenerations = mockGenerations.filter(g => g.user_id !== userId);
    mockProfiles = mockProfiles.filter(p => p.id !== userId);

    // Anonymize logs
    mockAnonymizedLogs.forEach(log => {
      if (log.user_id === userId) {
        log.user_id = null;
      }
    });

    return { success: true, deletedCounts };
  },

  anonymizeData: (userId: string): boolean => {
    mockAnonymizedLogs.forEach(log => {
      if (log.user_id === userId) {
        log.user_id = null;
      }
    });
    return true;
  },
};

describe('RGPD Compliance - Data Export', () => {
  it('Export données user (RGPD Art. 20)', () => {
    mockProfiles = [
      { id: 'user-1', email: 'john@test.com', full_name: 'John Doe', plan: 'pro' },
    ];
    mockBrands = [
      { id: 'brand-1', user_id: 'user-1', name: 'My Brand' },
    ];
    mockAssets = [
      { id: 'asset-1', user_id: 'user-1', type: 'image' },
      { id: 'asset-2', user_id: 'user-1', type: 'carousel' },
    ];
    mockJobs = [
      { id: 'job-1', user_id: 'user-1', status: 'completed' },
    ];
    mockGenerations = [
      { id: 'gen-1', user_id: 'user-1', prompt: 'Create marketing image' },
    ];

    const exportedData = rgpdService.exportUserData('user-1');

    expect(exportedData).not.toBeNull();
    expect(exportedData?.profile.email).toBe('john@test.com');
    expect(exportedData?.brands).toHaveLength(1);
    expect(exportedData?.assets).toHaveLength(2);
    expect(exportedData?.jobs).toHaveLength(1);
    expect(exportedData?.generations).toHaveLength(1);
  });
});

describe('RGPD Compliance - Account Deletion', () => {
  it('Suppression compte cascade (brands, assets, jobs) - RGPD Art. 17', () => {
    mockProfiles = [
      { id: 'user-1', email: 'john@test.com', full_name: 'John Doe', plan: 'pro' },
      { id: 'user-2', email: 'jane@test.com', full_name: 'Jane Doe', plan: 'free' },
    ];
    mockBrands = [
      { id: 'brand-1', user_id: 'user-1', name: 'Brand 1' },
      { id: 'brand-2', user_id: 'user-2', name: 'Brand 2' },
    ];
    mockAssets = [
      { id: 'asset-1', user_id: 'user-1', type: 'image' },
      { id: 'asset-2', user_id: 'user-1', type: 'carousel' },
      { id: 'asset-3', user_id: 'user-2', type: 'video' },
    ];
    mockJobs = [
      { id: 'job-1', user_id: 'user-1', status: 'completed' },
    ];
    mockGenerations = [
      { id: 'gen-1', user_id: 'user-1', prompt: 'test' },
    ];
    mockAnonymizedLogs = [
      { id: 'log-1', user_id: 'user-1', action: 'login' },
      { id: 'log-2', user_id: 'user-2', action: 'login' },
    ];

    const result = rgpdService.deleteUserAccount('user-1');

    expect(result.success).toBe(true);
    expect(result.deletedCounts.brands).toBe(1);
    expect(result.deletedCounts.assets).toBe(2);
    expect(result.deletedCounts.jobs).toBe(1);
    expect(result.deletedCounts.generations).toBe(1);

    // Vérifie que les données de user-2 sont intactes
    expect(mockProfiles).toHaveLength(1);
    expect(mockBrands).toHaveLength(1);
    expect(mockAssets).toHaveLength(1);
    expect(mockProfiles[0].id).toBe('user-2');
  });
});

describe('RGPD Compliance - Data Anonymization', () => {
  it('Anonymisation données après suppression', () => {
    mockAnonymizedLogs = [
      { id: 'log-1', user_id: 'user-1', action: 'generation' },
      { id: 'log-2', user_id: 'user-1', action: 'login' },
      { id: 'log-3', user_id: 'user-2', action: 'generation' },
    ];

    rgpdService.anonymizeData('user-1');

    const user1Logs = mockAnonymizedLogs.filter(l => l.user_id === 'user-1');
    const anonymizedLogs = mockAnonymizedLogs.filter(l => l.user_id === null);
    const user2Logs = mockAnonymizedLogs.filter(l => l.user_id === 'user-2');

    expect(user1Logs).toHaveLength(0);
    expect(anonymizedLogs).toHaveLength(2);
    expect(user2Logs).toHaveLength(1);
  });
});
