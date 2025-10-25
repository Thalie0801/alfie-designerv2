import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

/**
 * Vérifie si un utilisateur a accès aux fonctionnalités payantes
 * Accès autorisé si :
 * - Abonnement Stripe actif (plan non null + stripe_subscription_id présent)
 * - OU granted_by_admin = true
 */
export async function assertUserHasAccess(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const enforcementFlag = Deno.env.get('AUTH_ENFORCEMENT');
    if (enforcementFlag && enforcementFlag.toLowerCase() === 'off') {
      return { success: true };
    }

    // Appeler la fonction DB qui vérifie l'accès
    const { data, error } = await supabaseClient.rpc('user_has_access', {
      user_id_param: userId,
    });

    if (error) {
      console.error('[ACCESS] Error checking access:', error);
      return { success: false, error: 'Failed to verify access' };
    }

    const hasAccess = Boolean(data);

    if (!hasAccess) {
      return {
        success: false,
        error: 'Access denied. Active subscription or manual access required.',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[ACCESS] Exception checking access:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
