/**
 * Tests Admin Dashboard - Phase 3 UX & Features
 * Vérifie les contrôles administrateur
 */

import { describe, it, expect } from 'vitest';

// Types pour l'admin
interface User {
  id: string;
  email: string;
  plan: string;
  role: 'user' | 'admin';
}

interface GenerationLog {
  id: string;
  user_id: string;
  type: string;
  status: string;
  created_at: Date;
}

// Mock de la base de données
let mockUsers: User[] = [];
let mockLogs: GenerationLog[] = [];
let mockJobQueue: Array<{ id: string; status: string }> = [];

// Service admin simulé
const adminService = {
  assertIsAdmin: (userId: string): boolean => {
    const user = mockUsers.find(u => u.id === userId);
    if (!user || user.role !== 'admin') {
      throw new Error('Access denied: admin role required');
    }
    return true;
  },

  listAllUsers: (adminId: string): User[] => {
    adminService.assertIsAdmin(adminId);
    return mockUsers;
  },

  updateUserPlan: (adminId: string, userId: string, newPlan: string): boolean => {
    adminService.assertIsAdmin(adminId);
    const user = mockUsers.find(u => u.id === userId);
    if (user) {
      user.plan = newPlan;
      return true;
    }
    return false;
  },

  getGenerationLogs: (adminId: string): GenerationLog[] => {
    adminService.assertIsAdmin(adminId);
    return mockLogs;
  },

  triggerJob: (adminId: string, jobId: string): boolean => {
    adminService.assertIsAdmin(adminId);
    const job = mockJobQueue.find(j => j.id === jobId);
    if (job && job.status === 'queued') {
      job.status = 'running';
      return true;
    }
    return false;
  },
};

describe('Admin Dashboard - Access Control', () => {
  it('assertIsAdmin bloque non-admin', () => {
    mockUsers = [
      { id: 'user-1', email: 'user@test.com', plan: 'free', role: 'user' },
    ];

    expect(() => adminService.assertIsAdmin('user-1')).toThrow('Access denied: admin role required');
  });

  it('assertIsAdmin autorise admin', () => {
    mockUsers = [
      { id: 'admin-1', email: 'admin@test.com', plan: 'pro', role: 'admin' },
    ];

    expect(adminService.assertIsAdmin('admin-1')).toBe(true);
  });
});

describe('Admin Dashboard - User Management', () => {
  it('Admin peut lister tous les users', () => {
    mockUsers = [
      { id: 'user-1', email: 'user1@test.com', plan: 'free', role: 'user' },
      { id: 'user-2', email: 'user2@test.com', plan: 'pro', role: 'user' },
      { id: 'admin-1', email: 'admin@test.com', plan: 'pro', role: 'admin' },
    ];

    const users = adminService.listAllUsers('admin-1');

    expect(users).toHaveLength(3);
  });

  it('Admin peut modifier plan user', () => {
    mockUsers = [
      { id: 'user-1', email: 'user1@test.com', plan: 'free', role: 'user' },
      { id: 'admin-1', email: 'admin@test.com', plan: 'pro', role: 'admin' },
    ];

    const result = adminService.updateUserPlan('admin-1', 'user-1', 'pro');

    expect(result).toBe(true);
    expect(mockUsers.find(u => u.id === 'user-1')?.plan).toBe('pro');
  });
});

describe('Admin Dashboard - Logs & Monitoring', () => {
  it('Admin peut voir logs génération', () => {
    mockUsers = [
      { id: 'admin-1', email: 'admin@test.com', plan: 'pro', role: 'admin' },
    ];
    mockLogs = [
      { id: 'log-1', user_id: 'user-1', type: 'image', status: 'completed', created_at: new Date() },
      { id: 'log-2', user_id: 'user-2', type: 'carousel', status: 'failed', created_at: new Date() },
    ];

    const logs = adminService.getGenerationLogs('admin-1');

    expect(logs).toHaveLength(2);
    expect(logs[0].type).toBe('image');
    expect(logs[1].status).toBe('failed');
  });
});

describe('Admin Dashboard - Job Control', () => {
  it('Admin peut trigger job manuellement', () => {
    mockUsers = [
      { id: 'admin-1', email: 'admin@test.com', plan: 'pro', role: 'admin' },
    ];
    mockJobQueue = [
      { id: 'job-1', status: 'queued' },
    ];

    const result = adminService.triggerJob('admin-1', 'job-1');

    expect(result).toBe(true);
    expect(mockJobQueue[0].status).toBe('running');
  });

  it('Non-admin ne peut pas trigger job', () => {
    mockUsers = [
      { id: 'user-1', email: 'user@test.com', plan: 'free', role: 'user' },
    ];
    mockJobQueue = [
      { id: 'job-1', status: 'queued' },
    ];

    expect(() => adminService.triggerJob('user-1', 'job-1')).toThrow('Access denied');
  });
});
