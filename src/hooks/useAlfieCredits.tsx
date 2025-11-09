import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/lib/supabaseSafeClient';

export function useAlfieCredits() {
  const { user } = useAuth();
  const [credits, setCredits] = useState({
    monthly: 0,
    purchased: 0,
    affiliation: 0
  });
  const [generations, setGenerations] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadCredits = useCallback(async () => {
    if (!user) {
      setCredits({ monthly: 0, purchased: 0, affiliation: 0 });
      setGenerations(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('ai_credits_monthly, ai_credits_purchased, ai_credits_from_affiliation, generations_this_month')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setCredits({
        monthly: data?.ai_credits_monthly || 0,
        purchased: data?.ai_credits_purchased || 0,
        affiliation: data?.ai_credits_from_affiliation || 0
      });
      setGenerations(data?.generations_this_month || 0);
    } catch (error) {
      console.error('Error loading credits:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  const getTotalCredits = () => {
    return credits.monthly + credits.purchased + credits.affiliation;
  };

  const decrementCredits = async (amount: number, action: string) => {
    if (!user) return 0;

    const total = getTotalCredits();
    if (total < amount) {
      throw new Error('Crédits insuffisants');
    }

    try {
      let remaining = amount;
      const newCredits = { ...credits };

      // Consume in order: monthly → purchased → affiliation
      if (newCredits.monthly >= remaining) {
        newCredits.monthly -= remaining;
        remaining = 0;
      } else {
        remaining -= newCredits.monthly;
        newCredits.monthly = 0;

        if (newCredits.purchased >= remaining) {
          newCredits.purchased -= remaining;
          remaining = 0;
        } else {
          remaining -= newCredits.purchased;
          newCredits.purchased = 0;
          newCredits.affiliation -= remaining;
        }
      }

      // Update in database
      const { error } = await supabase
        .from('profiles')
        .update({
          ai_credits_monthly: newCredits.monthly,
          ai_credits_purchased: newCredits.purchased,
          ai_credits_from_affiliation: newCredits.affiliation
        })
        .eq('id', user.id);

      if (error) throw error;

      // Log transaction
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          amount: -amount,
          transaction_type: 'usage',
          action
        });

      setCredits(newCredits);
      return getTotalCredits();
    } catch (error) {
      console.error('Error decrementing credits:', error);
      throw error;
    }
  };

  const addCredits = async (amount: number, type: 'monthly' | 'purchased' | 'affiliation') => {
    if (!user) return;

    const newCredits = { ...credits };
    newCredits[type] += amount;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ai_credits_monthly: newCredits.monthly,
          ai_credits_purchased: newCredits.purchased,
          ai_credits_from_affiliation: newCredits.affiliation
        })
        .eq('id', user.id);

      if (error) throw error;

      setCredits(newCredits);
    } catch (error) {
      console.error('Error adding credits:', error);
      throw error;
    }
  };

  const incrementGenerations = async () => {
    if (!user) return;

    try {
      const newCount = generations + 1;
      
      const { error } = await supabase
        .from('profiles')
        .update({ generations_this_month: newCount })
        .eq('id', user.id);

      if (error) throw error;

      setGenerations(newCount);
      
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          amount: 0,
          transaction_type: 'usage',
          action: 'generation'
        });
    } catch (error) {
      console.error('Error incrementing generations:', error);
      throw error;
    }
  };

  const hasCredits = (amount: number = 1) => getTotalCredits() >= amount;

  const refreshCredits = () => loadCredits();

  return {
    credits,
    totalCredits: getTotalCredits(),
    generations,
    loading,
    decrementCredits,
    addCredits,
    incrementGenerations,
    hasCredits,
    refreshCredits
  };
}
