import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Liste des emails admin
const ADMIN_EMAILS = [
  'nathaliestaelens@gmail.com',
]

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

    if (!ADMIN_EMAILS.includes(user.email || '')) {
      throw new Error('Accès refusé : droits administrateur requis')
    }

    console.log('Admin verified:', user.email)

    // Créer l'utilisateur
    const createUserData: any = {
      email,
      email_confirm: !sendInvite,
      user_metadata: {
        full_name: fullName || '',
        plan: plan,
      }
    }

    if (!sendInvite && password) {
      createUserData.password = password
    }

    console.log('Creating user with data:', { email, plan, sendInvite })

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser(createUserData)

    if (createError) {
      console.error('Error creating user:', createError)
      throw new Error(createError.message)
    }

    console.log('User created successfully:', newUser.user?.id)

    // Créer ou mettre à jour le profil
    if (newUser.user) {
      const { error: upsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: newUser.user.id,
          full_name: fullName || '',
          plan: plan,
          updated_at: new Date().toISOString(),
        })

      if (upsertError) {
        console.error('Error upserting profile:', upsertError)
        // Ne pas échouer si l'upsert échoue
      }
    }

    // Envoyer l'invitation par email si demandé
    if (sendInvite && newUser.user) {
      console.log('Sending invite to:', email)
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
      if (inviteError) {
        console.error('Error sending invite:', inviteError)
        // Ne pas échouer si l'invitation échoue
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

  } catch (error: any) {
    console.error('Error in admin-create-user:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Une erreur est survenue',
        details: error?.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})



     
      
