import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

/**
 * Incrémenter le compteur de générations dans profiles
 */
export async function incrementProfileGenerations(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    const { data: profile, error: fetchError } = await supabaseClient
      .from('profiles')
      .select('generations_this_month, generations_reset_date')
      .eq('id', userId)
      .single();

    if (fetchError || !profile) {
      console.error('Error fetching profile for generation increment:', fetchError);
      return;
    }

    // Vérifier si on doit reset (début de nouveau mois)
    const now = new Date();
    const resetDate = profile.generations_reset_date ? new Date(profile.generations_reset_date) : null;
    
    let newCount = (profile.generations_this_month || 0) + 1;
    let newResetDate = resetDate;

    // Si on a dépassé la date de reset, réinitialiser
    if (resetDate && now > resetDate) {
      newCount = 1;
      // Définir la prochaine date de reset au début du mois suivant
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      newResetDate = nextMonth;
    }

    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        generations_this_month: newCount,
        ...(newResetDate && { generations_reset_date: newResetDate.toISOString() })
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating profile generations:', updateError);
    }
  } catch (error) {
    console.error('Exception incrementing profile generations:', error);
  }
}
