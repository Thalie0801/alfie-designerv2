import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface AccessStatus {
  hasAccess: boolean;
  loading: boolean;
  reason?: string;
}

/**
 * Hook pour vérifier si l'utilisateur a accès aux fonctionnalités payantes
 * Accès autorisé si :
 * - Abonnement Stripe actif (plan + stripe_subscription_id)
 * - OU granted_by_admin = true
 */
export function useAccessControl(): AccessStatus {
  const { user, profile, isAdmin, isAuthorized } = useAuth();
  const [accessStatus, setAccessStatus] = useState<AccessStatus>({
    hasAccess: false,
    loading: true,
  });
  const authEnforcement = import.meta.env.VITE_AUTH_ENFORCEMENT;
  const killSwitchDisabled = typeof authEnforcement === 'string' && authEnforcement.toLowerCase() === 'off';

  useEffect(() => {
    async function checkAccess() {
      if (!user || !profile) {
        setAccessStatus({
          hasAccess: false,
          loading: false,
          reason: 'Utilisateur non connecté',
        });
        return;
      }

      if (killSwitchDisabled || isAdmin || isAuthorized) {
        setAccessStatus({
          hasAccess: true,
          loading: false,
        });
        return;
      }

      // Vérifier via la fonction DB
      const { data, error } = await supabase.rpc('user_has_access', {
        user_id_param: user.id,
      });

      if (error) {
        console.error('Error checking access:', error);
        setAccessStatus({
          hasAccess: false,
          loading: false,
          reason: 'Erreur lors de la vérification',
        });
        return;
      }

      const hasAccess = Boolean(data);
      setAccessStatus({
        hasAccess,
        loading: false,
        reason: hasAccess
          ? undefined
          : 'Abonnement requis. Activez votre accès pour continuer.',
      });
    }

    checkAccess();
  }, [user, profile, isAdmin, isAuthorized, killSwitchDisabled]);

  return accessStatus;
}
