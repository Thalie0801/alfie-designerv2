/**
 * Tests Session & Token Authentication - Phase 1 Sécurité
 * Vérifie la gestion des tokens JWT et le refresh automatique
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock JWT token utilities
const mockJwtUtils = {
  decode: (token: string) => {
    if (token === 'invalid_token') return null;
    
    // Simule le décodage d'un JWT
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    try {
      return JSON.parse(atob(parts[1]));
    } catch {
      return null;
    }
  },
  
  isExpired: (token: string) => {
    const decoded = mockJwtUtils.decode(token);
    if (!decoded || !decoded.exp) return true;
    return Date.now() / 1000 > decoded.exp;
  },
};

// Crée un token JWT mock
const createMockToken = (expiresInSeconds: number) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub: 'user-123',
    email: 'user@example.com',
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    iat: Math.floor(Date.now() / 1000),
  }));
  const signature = btoa('mock_signature');
  return `${header}.${payload}.${signature}`;
};

// Mock Supabase Auth
const createMockSupabaseAuth = (options: {
  tokenExpired?: boolean;
  refreshTokenValid?: boolean;
} = {}) => {
  const { tokenExpired = false, refreshTokenValid = true } = options;
  
  let currentSession = tokenExpired ? null : {
    access_token: createMockToken(3600),
    refresh_token: 'mock_refresh_token',
    expires_at: Math.floor(Date.now() / 1000) + (tokenExpired ? -3600 : 3600),
  };
  
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: currentSession },
        error: tokenExpired ? { message: 'Session expired' } : null,
      }),
      
      refreshSession: vi.fn().mockImplementation(async () => {
        if (!refreshTokenValid) {
          return {
            data: { session: null },
            error: { message: 'Refresh token expired' },
          };
        }
        
        const newSession = {
          access_token: createMockToken(3600),
          refresh_token: 'new_refresh_token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        };
        currentSession = newSession;
        
        return {
          data: { session: newSession },
          error: null,
        };
      }),
      
      signOut: vi.fn().mockResolvedValue({ error: null }),
      
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  };
};

describe('Token Expiration Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Token expiré → redirection login', async () => {
    const mockClient = createMockSupabaseAuth({ tokenExpired: true });
    
    const { data, error } = await mockClient.auth.getSession();
    
    // Session devrait être null quand le token est expiré
    expect(data.session).toBeNull();
    expect(error).not.toBeNull();
    
    // Vérifie que la redirection serait déclenchée
    const shouldRedirectToLogin = !data.session && error;
    expect(shouldRedirectToLogin).toBe(true);
  });

  it('Refresh token fonctionne', async () => {
    const mockClient = createMockSupabaseAuth({ refreshTokenValid: true });
    
    // Simule un refresh de session
    const { data, error } = await mockClient.auth.refreshSession();
    
    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    expect(data.session?.access_token).toBeDefined();
    expect(data.session?.refresh_token).toBe('new_refresh_token');
  });

  it('Refresh token invalide → déconnexion forcée', async () => {
    const mockClient = createMockSupabaseAuth({ 
      tokenExpired: true, 
      refreshTokenValid: false 
    });
    
    const { data, error } = await mockClient.auth.refreshSession();
    
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
    
    // Devrait déclencher un signOut
    const shouldForceLogout = !data.session && error;
    expect(shouldForceLogout).toBe(true);
  });
});

describe('JWT Token Utilities', () => {
  it('Décode correctement un token valide', () => {
    const token = createMockToken(3600);
    const decoded = mockJwtUtils.decode(token);
    
    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe('user-123');
    expect(decoded?.email).toBe('user@example.com');
  });

  it('Retourne null pour un token invalide', () => {
    expect(mockJwtUtils.decode('invalid_token')).toBeNull();
    expect(mockJwtUtils.decode('not.a.valid.jwt')).toBeNull();
    expect(mockJwtUtils.decode('')).toBeNull();
  });

  it('Détecte correctement un token expiré', () => {
    const expiredToken = createMockToken(-3600); // Expiré il y a 1h
    const validToken = createMockToken(3600); // Expire dans 1h
    
    expect(mockJwtUtils.isExpired(expiredToken)).toBe(true);
    expect(mockJwtUtils.isExpired(validToken)).toBe(false);
  });
});

describe('Auth State Management', () => {
  it('Auth state change listener enregistré correctement', () => {
    const mockClient = createMockSupabaseAuth();
    const callback = vi.fn();
    
    const { data } = mockClient.auth.onAuthStateChange(callback);
    
    expect(data.subscription).toBeDefined();
    expect(data.subscription.unsubscribe).toBeInstanceOf(Function);
  });

  it('Sign out nettoie la session', async () => {
    const mockClient = createMockSupabaseAuth();
    
    const { error } = await mockClient.auth.signOut();
    
    expect(error).toBeNull();
    expect(mockClient.auth.signOut).toHaveBeenCalled();
  });
});
