import { createClient } from '@supabase/supabase-js'
import { carregarEnvLocal, env } from './env'

/**
 * Prepara o Supabase local para o e2e, sempre com a service role.
 * `supabase db reset` apaga os usuários de desenvolvimento, então o teste não depende
 * de ninguém criado à mão: aqui garantimos o admin da plataforma e um plano com todos
 * os módulos. É idempotente — pode rodar quantas vezes for preciso.
 */
export const ADMIN_EMAIL = 'admin@local.test'
export const ADMIN_SENHA = 'admin123'
export const PLANO_E2E = 'E2E Completo'

/** Só roda contra Supabase local (127.0.0.1 ou localhost). Evita criar um admin de senha
 *  conhecida (admin@local.test / admin123) e um plano de teste num projeto de produção. */
function exigirSupabaseLocal(url: string): void {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL inválida: ${url}`)
  }
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(
      `E2E abortado: NEXT_PUBLIC_SUPABASE_URL aponta para "${host}", não para o Supabase local ` +
        `(127.0.0.1 ou localhost). O globalSetup cria admin@local.test com senha conhecida e um ` +
        `plano de teste — isso nunca pode rodar contra produção. Ajuste o .env.local.`,
    )
  }
}

async function globalSetup() {
  carregarEnvLocal()
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  exigirSupabaseLocal(url)
  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1) Admin da plataforma (usuário no Auth + linha em admins_plataforma).
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 })
  let adminId = lista?.users.find((u) => u.email === ADMIN_EMAIL)?.id ?? null
  if (!adminId) {
    const criado = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_SENHA,
      email_confirm: true,
    })
    if (criado.error || !criado.data.user) throw new Error(`Não criou o admin: ${criado.error?.message}`)
    adminId = criado.data.user.id
  } else {
    // Garante a senha conhecida mesmo que o usuário já exista de outra forma.
    await admin.auth.admin.updateUserById(adminId, { password: ADMIN_SENHA, email_confirm: true })
  }
  const souAdmin = await admin.from('admins_plataforma').upsert({ user_id: adminId }, { onConflict: 'user_id' })
  if (souAdmin.error) throw new Error(`Não registrou admins_plataforma: ${souAdmin.error.message}`)

  // 2) Plano com todos os módulos, para a loja do teste ver Configurações, Fornecedores etc.
  const { data: plano } = await admin.from('planos').select('id').eq('nome', PLANO_E2E).maybeSingle()
  if (!plano) {
    const novo = await admin
      .from('planos')
      .insert({ nome: PLANO_E2E, modulos: ['servico', 'estoque', 'vendas', 'fornecedores', 'financeiro'], limite_usuarios: 5 })
    if (novo.error) throw new Error(`Não criou o plano ${PLANO_E2E}: ${novo.error.message}`)
  }
}

export default globalSetup
