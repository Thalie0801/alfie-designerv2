
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Gérer les requêtes preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    })
  }

  try {
    // Créer un client Supabase avec la clé service_role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Récupérer les données de la requête
    const { email, fullName, plan, sendInvite, password } = await req.json()

    // Vérifier que l'utilisateur actuel est authentifié
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Non authentifié')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Non authentifié')
    }

    // Vérifier le rôle admin
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      throw new Error('Accès refusé : droits administrateur requis')
    }

    // Créer l'utilisateur
    const createUserData: any = {
      email,
      email_confirm: !sendInvite,
      user_metadata: {
        full_name: fullName || '',
        plan: plan,
      }
    }

    // Ajouter le mot de passe seulement si pas d'invitation
    if (!sendInvite && password) {
      createUserData.password = password
    }

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser(createUserData)

    if (createError) {
      throw new Error(createError.message)
    }

    // Créer ou mettre à jour le profil
    if (newUser.user) {
      const { error: upsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: newUser.user.id,
          full_name: fullName || '',
          plan: plan,
          role: 'user', // Par défaut, les nouveaux utilisateurs sont 'user'
          updated_at: new Date().toISOString(),
        })

      if (upsertError) {
        console.error('Error upserting profile:', upsertError)
      }
    }

    // Envoyer l'invitation par email si demandé
    if (sendInvite && newUser.user) {
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
      if (inviteError) {
        console.error('Error sending invite:', inviteError)
        // Ne pas échouer si l'invitation échoue, l'utilisateur est déjà créé
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: newUser,
        message: sendInvite 
          ? 'Utilisateur créé et invitation envoyée' 
          : 'Utilisateur créé avec succès'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in admin-create-user:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Une erreur est survenue',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
