/**
 * Tests Woofs Advanced - Phase 2 Core Business
 * Vérifie la gestion avancée des Woofs : reset mensuel, synchronisation, alertes
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Types
interface Brand {
  id: string;
  user_id: string;
  name: string;
  quota_woofs: number;
  woofs_used: number;
  resets_on: Date;
}

interface Profile {
  id: string;
  email: string;
  plan: string;
  woofs_consumed_this_month: number;
}

interface CountersMonthly {
  brand_id: string;
  period_yyyymm: number;
  woofs_used: number;
  images_used: number;
  reels_used: number;
}

// Mock data
let mockBrands: Brand[] = [];
let mockProfiles: Profile[] = [];
let mockCounters: CountersMonthly[] = [];

// Reset avant chaque test
beforeEach(() => {
  mockBrands = [
    {
      id: 'brand-1',
      user_id: 'user-1',
      name: 'Test Brand',
      quota_woofs: 450,
      woofs_used: 350,
      resets_on: new Date(),
    },
  ];
  
  mockProfiles = [
    {
      id: 'user-1',
      email: 'user@example.com',
      plan: 'pro',
      woofs_consumed_this_month: 350,
    },
  ];
  
  mockCounters = [
    {
      brand_id: 'brand-1',
      period_yyyymm: 202501,
      woofs_used: 350,
      images_used: 100,
      reels_used: 5,
    },
  ];
});

// Services simulés
const woofsService = {
  getCurrentPeriod: (): number => {
    const now = new Date();
    return now.getFullYear() * 100 + (now.getMonth() + 1);
  },

  resetMonthlyCounters: (brandId: string): boolean => {
    const brand = mockBrands.find(b => b.id === brandId);
    if (!brand) return false;

    // Reset brand counters
    brand.woofs_used = 0;
    brand.resets_on = new Date(new Date().setMonth(new Date().getMonth() + 1, 1));

    // Créer nouveau compteur mensuel
    const newPeriod = woofsService.getCurrentPeriod();
    const existingCounter = mockCounters.find(
      c => c.brand_id === brandId && c.period_yyyymm === newPeriod
    );
    
    if (!existingCounter) {
      mockCounters.push({
        brand_id: brandId,
        period_yyyymm: newPeriod,
        woofs_used: 0,
        images_used: 0,
        reels_used: 0,
      });
    }

    return true;
  },

  consumeWoofs: (brandId: string, amount: number): { success: boolean; remaining: number } => {
    const brand = mockBrands.find(b => b.id === brandId);
    if (!brand) return { success: false, remaining: 0 };

    const remaining = brand.quota_woofs - brand.woofs_used;
    if (amount > remaining) {
      return { success: false, remaining };
    }

    brand.woofs_used += amount;

    // Synchroniser avec counters_monthly
    const period = woofsService.getCurrentPeriod();
    let counter = mockCounters.find(
      c => c.brand_id === brandId && c.period_yyyymm === period
    );
    if (counter) {
      counter.woofs_used += amount;
    }

    // Synchroniser avec profile
    const profile = mockProfiles.find(p => p.id === brand.user_id);
    if (profile) {
      profile.woofs_consumed_this_month += amount;
    }

    return { success: true, remaining: remaining - amount };
  },

  getQuotaPercentage: (brandId: string): number => {
    const brand = mockBrands.find(b => b.id === brandId);
    if (!brand || brand.quota_woofs === 0) return 0;
    return (brand.woofs_used / brand.quota_woofs) * 100;
  },

  shouldAlertAt80Percent: (brandId: string): boolean => {
    return woofsService.getQuotaPercentage(brandId) >= 80;
  },

  canGenerate: (brandId: string, woofsNeeded: number): boolean => {
    const brand = mockBrands.find(b => b.id === brandId);
    if (!brand) return false;
    return (brand.woofs_used + woofsNeeded) <= brand.quota_woofs;
  },
};

describe('Woofs - Reset Mensuel', () => {
  it('Reset mensuel des compteurs (1er du mois)', () => {
    const brandId = 'brand-1';
    const brand = mockBrands.find(b => b.id === brandId)!;
    
    // Vérifie état initial
    expect(brand.woofs_used).toBe(350);

    // Exécute le reset
    const success = woofsService.resetMonthlyCounters(brandId);

    expect(success).toBe(true);
    expect(brand.woofs_used).toBe(0);
    
    // Vérifie qu'un nouveau compteur mensuel a été créé
    const currentPeriod = woofsService.getCurrentPeriod();
    const newCounter = mockCounters.find(
      c => c.brand_id === brandId && c.period_yyyymm === currentPeriod
    );
    expect(newCounter).toBeDefined();
  });
});

describe('Woofs - Synchronisation', () => {
  it('Compteurs brand vs compteurs profile synchronisés', () => {
    const brandId = 'brand-1';
    const brand = mockBrands.find(b => b.id === brandId)!;
    const profile = mockProfiles.find(p => p.id === brand.user_id)!;
    
    const initialBrandWoofs = brand.woofs_used;
    const initialProfileWoofs = profile.woofs_consumed_this_month;

    // Consommer des woofs
    woofsService.consumeWoofs(brandId, 25);

    // Vérifier la synchronisation
    expect(brand.woofs_used).toBe(initialBrandWoofs + 25);
    expect(profile.woofs_consumed_this_month).toBe(initialProfileWoofs + 25);

    // Vérifier counters_monthly
    const period = woofsService.getCurrentPeriod();
    const counter = mockCounters.find(
      c => c.brand_id === brandId && c.period_yyyymm === period
    );
    expect(counter?.woofs_used).toBe(375); // 350 initial + 25
  });
});

describe('Woofs - Alertes & Blocage', () => {
  it('Alerte email à 80% du quota', () => {
    // Brand a 350/450 woofs = 77.7%
    expect(woofsService.shouldAlertAt80Percent('brand-1')).toBe(false);

    // Consommer 15 woofs de plus = 365/450 = 81.1%
    woofsService.consumeWoofs('brand-1', 15);
    
    expect(woofsService.shouldAlertAt80Percent('brand-1')).toBe(true);
    expect(woofsService.getQuotaPercentage('brand-1')).toBeGreaterThanOrEqual(80);
  });

  it('Blocage génération à 100% du quota', () => {
    const brandId = 'brand-1';
    const brand = mockBrands.find(b => b.id === brandId)!;
    
    // Remplir le quota à 100%
    brand.woofs_used = brand.quota_woofs;

    // Tentative de génération avec 1 woof
    expect(woofsService.canGenerate(brandId, 1)).toBe(false);

    // Tentative de génération avec 0 woofs (devrait passer)
    expect(woofsService.canGenerate(brandId, 0)).toBe(true);
  });

  it('Génération autorisée si quota suffisant', () => {
    const brandId = 'brand-1';
    
    // 350/450 utilisés, 100 restants
    expect(woofsService.canGenerate(brandId, 50)).toBe(true);
    expect(woofsService.canGenerate(brandId, 100)).toBe(true);
    expect(woofsService.canGenerate(brandId, 101)).toBe(false);
  });
});

describe('Woofs - Consommation', () => {
  it('Consommation réussie retourne remaining correct', () => {
    const result = woofsService.consumeWoofs('brand-1', 50);
    
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(50); // 450 - 350 - 50 = 50
  });

  it('Consommation échouée si insuffisant', () => {
    const result = woofsService.consumeWoofs('brand-1', 200);
    
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(100); // 450 - 350 = 100 disponibles
  });
});
