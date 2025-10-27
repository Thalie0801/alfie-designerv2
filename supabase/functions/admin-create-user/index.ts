// supabase/functions/admin-create-user/index.ts
// Deno / Supabase Edge Function
// POST /admin-create-user
// Body: { email: string; fullName?: string; plan: 'FREE'|'PRO'|'ENTERPRISE'; sendInvite?: boolean; grantedByAdmin?: boolean; password?: string }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

// --- Admins autorisés (de base: ceux que tu avais). Tu peux aussi piloter via env: ADMIN_EMAILS
const HARDCODED_ADMIN_EMAILS = [
  'nathaliestaelens@gmail.com',
  'staelensnathalie@gmail.com',
]

function listEnv(key: string): string[] {
  return (Deno.env.get(key) || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}
const ADMIN_EMAILS = new Set([
  ...HARDCODED_ADMIN_EMAILS.map((e) => e.toLowerCase()),
  ...listEnv('ADMIN_EMAILS'),
])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-email',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Plan = 'FREE' | 'PRO' | 'ENTERPRISE'
type Body = {
  email?: string
  fullName?: string
  plan?: Plan
  sendInvite?: boolean
  grantedByAdmin?: boolean
  password?: string
}

function isEmail(s?: string): s is string {
  return !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return new Response(
        JSON.stringify({ error: 'missing_service_role_or_url' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }

    // client "admin" (service role) pour créer des users et bypass RLS
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1) Authentifier l’appelant via le Bearer token + vérifier qu’il est admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthenticated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: who, error: getUserErr } = await supabaseAdmin.auth.getUser(token)
    if (getUserErr || !who?.user?.email) {
      return new Response(JSON.stringify({ error: 'unauthenticated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const callerEmail = String(who.user.email).toLowerCase()
    if (!ADMIN_EMAILS.has(callerEmail)) {
      return new Response(JSON.stringify({ error: 'forbidden_admin_only' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 2) Lecture & validation body
    const { email, fullName, plan, sendInvite, grantedByAdmin, password } = (await req.json()) as Body

    if (!isEmail(email) || !plan) {
      return new Response(JSON.stringify({ error: 'email_plan_required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    if (!['FREE', 'PRO', 'ENTERPRISE'].includes(plan)) {
      return new Response(JSON.stringify({ error: 'invalid_plan' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 3) Création utilisateur Auth (email confirmé si pas d’invitation)
    const createPayload: any = {
      email,
      email_confirm: !sendInvite,
      user_metadata: {
        full_name: fullName || '',
        plan,
        granted_by_admin: !!grantedByAdmin,
      },
    }
    if (!sendInvite && password) {
      createPayload.password = password
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser(createPayload)

    let targetUserId: string | null = created?.user?.id ?? null

    // 4) Si déjà existant, récupérer l’utilisateur
    if (createErr) {
      // Certaines erreurs “utilisateur déjà inscrit” arrivent ici
      // Supabase v2 propose listUsers avec filtres (selon version). On tente un filtrage par email.
      const { data: listed, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      })

      if (listErr) {
        // Si on ne peut pas lister, renvoyer l’erreur initiale
        return new Response(JSON.stringify({ error: createErr.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      const existing = listed.users?.find((u: any) => (u.email || '').toLowerCase() === email.toLowerCase())
      if (!existing) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      targetUserId = existing.id
    }

    // 5) Upsert du profil (table: profiles). Adapte si ta table s’appelle différemment.
    //    On utilise l’id auth comme PK pour rester aligné avec les pratiques Supabase.
    if (targetUserId) {
      const now = new Date().toISOString()
      const { error: upsertErr } = await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            id: targetUserId,
            email: email.toLowerCase(),
            full_name: fullName || '',
            plan, // 'FREE' | 'PRO' | 'ENTERPRISE'
            granted_by_admin: !!grantedByAdmin,
            updated_at: now,
            // created_at côté DB a souvent un default; sinon:
            // created_at: now,
          },
          { onConflict: 'id' },
        )

      if (upsertErr) {
        return new Response(JSON.stringify({ error: 'profile_upsert_failed', details: upsertErr.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
    }

    // 6) Envoi d’une invitation si demandé ET si le compte vient d’être créé
    if (sendInvite && created?.user) {
      const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
      // On ne bloque pas si l’invitation échoue, mais on le remonte dans la réponse
      if (inviteErr) {
        return new Response(
          JSON.stringify({
            success: true,
            user_id: targetUserId,
            email,
            plan,
            grantedByAdmin: !!grantedByAdmin,
            status: grantedByAdmin ? 'active' : 'pending',
            invite: 'failed',
            invite_error: inviteErr.message,
          }),
          { headers: { ...corsHeaders, 'Content



     
      
