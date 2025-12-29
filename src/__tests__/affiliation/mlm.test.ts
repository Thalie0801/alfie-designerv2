/**
 * Tests Affiliation MLM - Phase 3 UX & Features
 * Vérifie le système de commissions multi-niveaux
 */

import { describe, it, expect } from 'vitest';

// Types pour l'affiliation
interface Affiliate {
  id: string;
  user_id: string;
  parent_id: string | null;
  status: 'creator' | 'mentor' | 'leader';
  active_direct_referrals: number;
  total_referrals_level_2: number;
  total_referrals_level_3: number;
}

interface Commission {
  affiliate_id: string;
  level: number;
  rate: number;
  amount: number;
}

// Taux de commission par niveau
const COMMISSION_RATES = {
  level1: 0.15, // 15%
  level2: 0.05, // 5%
  level3: 0.02, // 2%
};

// Seuils d'upgrade
const UPGRADE_THRESHOLDS = {
  mentor: 3, // 3 filleuls actifs pour devenir mentor
  leader: 5, // 5 filleuls actifs pour devenir leader
};

// Service simulé
const affiliationService = {
  calculateCommissions: (
    saleAmount: number,
    affiliateChain: Affiliate[]
  ): Commission[] => {
    const commissions: Commission[] = [];

    affiliateChain.forEach((affiliate, index) => {
      const level = index + 1;
      if (level > 3) return; // Max 3 niveaux

      let rate = 0;
      if (level === 1) rate = COMMISSION_RATES.level1;
      else if (level === 2 && affiliate.status !== 'creator') rate = COMMISSION_RATES.level2;
      else if (level === 3 && affiliate.status === 'leader') rate = COMMISSION_RATES.level3;

      if (rate > 0) {
        commissions.push({
          affiliate_id: affiliate.id,
          level,
          rate,
          amount: saleAmount * rate,
        });
      }
    });

    return commissions;
  },

  checkUpgrade: (affiliate: Affiliate): Affiliate['status'] => {
    if (affiliate.active_direct_referrals >= UPGRADE_THRESHOLDS.leader) {
      return 'leader';
    }
    if (affiliate.active_direct_referrals >= UPGRADE_THRESHOLDS.mentor) {
      return 'mentor';
    }
    return 'creator';
  },

  trackClick: (affiliateId: string, utmParams: {
    source?: string;
    medium?: string;
    campaign?: string;
  }): { click_id: string; affiliate_id: string } => {
    return {
      click_id: `click-${Date.now()}`,
      affiliate_id: affiliateId,
      ...utmParams,
    };
  },
};

describe('Affiliation MLM - Commission Level 1', () => {
  it('Commission niveau 1 (15%)', () => {
    const saleAmount = 99; // €99 plan
    const affiliateChain: Affiliate[] = [
      {
        id: 'aff-1',
        user_id: 'user-1',
        parent_id: null,
        status: 'creator',
        active_direct_referrals: 1,
        total_referrals_level_2: 0,
        total_referrals_level_3: 0,
      },
    ];

    const commissions = affiliationService.calculateCommissions(saleAmount, affiliateChain);

    expect(commissions).toHaveLength(1);
    expect(commissions[0].level).toBe(1);
    expect(commissions[0].rate).toBe(0.15);
    expect(commissions[0].amount).toBe(14.85); // 99 * 0.15
  });
});

describe('Affiliation MLM - Commission Level 2', () => {
  it('Commission niveau 2 (5%) si mentor', () => {
    const saleAmount = 99;
    const affiliateChain: Affiliate[] = [
      {
        id: 'aff-1',
        user_id: 'user-1',
        parent_id: 'aff-2',
        status: 'creator',
        active_direct_referrals: 1,
        total_referrals_level_2: 0,
        total_referrals_level_3: 0,
      },
      {
        id: 'aff-2',
        user_id: 'user-2',
        parent_id: null,
        status: 'mentor', // Doit être mentor pour toucher niveau 2
        active_direct_referrals: 3,
        total_referrals_level_2: 0,
        total_referrals_level_3: 0,
      },
    ];

    const commissions = affiliationService.calculateCommissions(saleAmount, affiliateChain);

    expect(commissions).toHaveLength(2);
    expect(commissions[1].level).toBe(2);
    expect(commissions[1].rate).toBe(0.05);
    expect(commissions[1].amount).toBe(4.95); // 99 * 0.05
  });

  it('Pas de commission niveau 2 si creator', () => {
    const saleAmount = 99;
    const affiliateChain: Affiliate[] = [
      {
        id: 'aff-1',
        user_id: 'user-1',
        parent_id: 'aff-2',
        status: 'creator',
        active_direct_referrals: 1,
        total_referrals_level_2: 0,
        total_referrals_level_3: 0,
      },
      {
        id: 'aff-2',
        user_id: 'user-2',
        parent_id: null,
        status: 'creator', // Creator ne touche pas niveau 2
        active_direct_referrals: 1,
        total_referrals_level_2: 0,
        total_referrals_level_3: 0,
      },
    ];

    const commissions = affiliationService.calculateCommissions(saleAmount, affiliateChain);

    expect(commissions).toHaveLength(1); // Seulement niveau 1
  });
});

describe('Affiliation MLM - Commission Level 3', () => {
  it('Commission niveau 3 (2%) si leader', () => {
    const saleAmount = 99;
    const affiliateChain: Affiliate[] = [
      {
        id: 'aff-1',
        user_id: 'user-1',
        parent_id: 'aff-2',
        status: 'creator',
        active_direct_referrals: 1,
        total_referrals_level_2: 0,
        total_referrals_level_3: 0,
      },
      {
        id: 'aff-2',
        user_id: 'user-2',
        parent_id: 'aff-3',
        status: 'mentor',
        active_direct_referrals: 3,
        total_referrals_level_2: 0,
        total_referrals_level_3: 0,
      },
      {
        id: 'aff-3',
        user_id: 'user-3',
        parent_id: null,
        status: 'leader', // Doit être leader pour toucher niveau 3
        active_direct_referrals: 5,
        total_referrals_level_2: 3,
        total_referrals_level_3: 0,
      },
    ];

    const commissions = affiliationService.calculateCommissions(saleAmount, affiliateChain);

    expect(commissions).toHaveLength(3);
    expect(commissions[2].level).toBe(3);
    expect(commissions[2].rate).toBe(0.02);
    expect(commissions[2].amount).toBe(1.98); // 99 * 0.02
  });
});

describe('Affiliation MLM - Status Upgrades', () => {
  it('Upgrade statut creator → mentor (3 filleuls)', () => {
    const affiliate: Affiliate = {
      id: 'aff-1',
      user_id: 'user-1',
      parent_id: null,
      status: 'creator',
      active_direct_referrals: 3,
      total_referrals_level_2: 0,
      total_referrals_level_3: 0,
    };

    const newStatus = affiliationService.checkUpgrade(affiliate);

    expect(newStatus).toBe('mentor');
  });

  it('Upgrade statut mentor → leader (5 filleuls)', () => {
    const affiliate: Affiliate = {
      id: 'aff-1',
      user_id: 'user-1',
      parent_id: null,
      status: 'mentor',
      active_direct_referrals: 5,
      total_referrals_level_2: 3,
      total_referrals_level_3: 0,
    };

    const newStatus = affiliationService.checkUpgrade(affiliate);

    expect(newStatus).toBe('leader');
  });
});

describe('Affiliation MLM - UTM Tracking', () => {
  it('Tracking UTM affiliate link', () => {
    const click = affiliationService.trackClick('aff-123', {
      source: 'instagram',
      medium: 'social',
      campaign: 'summer2024',
    });

    expect(click.click_id).toBeDefined();
    expect(click.affiliate_id).toBe('aff-123');
  });
});
