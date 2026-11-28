import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Cliente sem sessão (papel `anon`), para o link público de acompanhamento. Não lê cookie nenhum:
 * mesmo que o visitante seja um funcionário logado, o link se comporta igual para todo mundo.
 */
export function criarClienteAnonimo() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
