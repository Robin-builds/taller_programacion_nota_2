import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'No autorizado' }, 401)
    }

    // Cliente con JWT del ADMIN para verificar identidad y rol
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Token inválido' }, 401)
    }

    // Verificar que el llamante sea ADMIN
    const { data: adminData, error: adminError } = await supabaseUser
      .from('usuarios')
      .select('rol, empresa_id')
      .eq('id', user.id)
      .single()

    if (adminError || !adminData) {
      return json({ error: 'Usuario sin perfil en la empresa' }, 403)
    }
    if (adminData.rol !== 'ADMIN') {
      return json({ error: 'Se requiere rol ADMIN para esta operación' }, 403)
    }

    const empresaId: string = adminData.empresa_id

    const { email, password, nombre } = await req.json()
    if (!email || !password || !nombre) {
      return json({ error: 'email, password y nombre son requeridos' }, 400)
    }
    if (password.length < 8) {
      return json({ error: 'La contraseña debe tener mínimo 8 caracteres' }, 400)
    }

    // Cliente con service role para Admin API
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Crear usuario en Supabase Auth con app_metadata correcto
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      app_metadata: { empresa_id: empresaId }
    })

    if (createError || !newUser?.user) {
      const mensaje = createError?.message?.includes('already registered')
        ? 'Email ya registrado en el sistema'
        : `Error al crear usuario: ${createError?.message}`
      return json({ error: mensaje }, 400)
    }

    const newUserId = newUser.user.id

    // Insertar en public.usuarios — si falla, hacer rollback del auth user
    const { error: insertError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: newUserId,
        empresa_id: empresaId,
        nombre: nombre.trim(),
        email: email.trim(),
        rol: 'OPERADOR'
      })

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      return json({ error: `Error al crear perfil: ${insertError.message}` }, 500)
    }

    return json({ user_id: newUserId }, 200)

  } catch (error) {
    return json({ error: `Error interno: ${error.message}` }, 500)
  }
})

function json(body: object, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
