import 'server-only'
import { createClient } from '@supabase/supabase-js'

/** Ignora RLS. Só para código de servidor da plataforma (nunca importar em Client Components). */
export function criarClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
