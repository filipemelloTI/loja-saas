import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { montarLinkDefinirSenha } from '@/lib/auth-links'
import { validarModulos } from '@/lib/permissoes'
import { primeiroErro, type Resultado } from '@/lib/resultado'
import { esquemaNovaLoja } from '@/lib/validacoes'
import type { Situacao } from '@/lib/rotulos'
import type { Modulo } from '@/lib/tipos'

/**
 * Regras das ações do painel da plataforma, com as dependências injetadas para teste.
 * As Server Actions (`src/app/plataforma/acoes.ts`) só montam as dependências.
 * Ordem sempre: validar (sem rede) → conferir admin no servidor → gravar com a service role.
 */
export type Dependencias = {
  /** O usuário da sessão é admin da plataforma? (cliente da sessão chamando `sou_admin_plataforma()`). */
  souAdmin: () => Promise<boolean>
  /** Cliente com service role: grava mesmo com acesso de suporte aberto na loja. */
  admin: SupabaseClient
  /** Origem do site para montar o link de definir senha. */
  origem: () => Promise<string>
  /** Loja que o admin atende agora em suporte (ou null), lida com o cliente da sessão (RLS). */
  lojaEmSuporte: () => Promise<string | null>
}

// `Resultado` vem de `@/lib/resultado`, reexportado para quem importa daqui.
// `ResultadoLink` é só desta camada (traz o link de definir senha).
export type { Resultado }
export type ResultadoLink = { ok: true; linkDefinirSenha: string } | { ok: false; erro: string }

const SITUACOES: Situacao[] = ['em_dia', 'atrasado', 'suspensa']

const ACESSO_NEGADO = { ok: false, erro: 'Acesso negado' } as const
const FALHA_CRIAR = 'Não foi possível criar a loja. Nada foi gravado; tente de novo.'
const ROLLBACK_INCOMPLETO =
  'A criação falhou e não foi possível desfazer tudo. Anote o e-mail e verifique no painel do Supabase.'

type ErroBanco = { message: string; code?: string } | null

/** Erros do banco em português. Os triggers (P0001) já falam português. */
function traduzir(erro: NonNullable<ErroBanco>, padrao: string): string {
  if (erro.code === 'P0001') return erro.message
  if (erro.code === '23514' && erro.message.includes('vendas_exige_estoque')) return 'Vendas exige o módulo Estoque'
  return padrao
}

async function gerarLink(admin: SupabaseClient, origem: string, email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  const token = data?.properties?.hashed_token
  if (error || !token) return null
  return montarLinkDefinirSenha(origem, token)
}

export async function criarLojaCom(deps: Dependencias, form: FormData): Promise<ResultadoLink> {
  const lido = esquemaNovaLoja.safeParse({
    nomeLoja: String(form.get('nomeLoja') ?? ''),
    nomeDono: String(form.get('nomeDono') ?? ''),
    emailDono: String(form.get('emailDono') ?? ''),
    planoId: String(form.get('planoId') ?? ''),
    modulos: form.getAll('modulos').map(String),
  })
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  if (!(await deps.souAdmin())) return ACESSO_NEGADO

  const v = lido.data
  const email = v.emailDono.toLowerCase()
  const { admin } = deps

  const loja = await admin
    .from('lojas')
    .insert({ nome: v.nomeLoja, plano_id: v.planoId, modulos: v.modulos })
    .select('id')
    .single()
  if (loja.error || !loja.data) return { ok: false, erro: traduzir(loja.error ?? { message: '' }, FALHA_CRIAR) }
  const lojaId = (loja.data as { id: string }).id

  // Desfaz o que foi criado. O Dono é gravado por último e nada falha depois dele,
  // então o rollback nunca esbarra no trigger que protege o último Dono ativo.
  // Se o próprio rollback falhar, avisa de verdade e registra os ids no servidor.
  const desfazer = async (userId: string | null, erro: string): Promise<ResultadoLink> => {
    const falhas: string[] = []
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) falhas.push('apagar usuário')
    }
    const { error } = await admin.rpc('desfazer_loja_nova', { p_loja: lojaId })
    if (error) falhas.push('apagar loja')
    if (falhas.length === 0) return { ok: false, erro }
    console.error('criarLoja: rollback incompleto', { lojaId, userId, falhou: falhas })
    return { ok: false, erro: ROLLBACK_INCOMPLETO }
  }

  const usuario = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nome: v.nomeDono },
  })
  if (usuario.error || !usuario.data.user) {
    const existe = usuario.error?.code === 'email_exists'
    return desfazer(null, existe ? 'Já existe um usuário com este e-mail' : FALHA_CRIAR)
  }
  const userId = usuario.data.user.id

  const link = await gerarLink(admin, await deps.origem(), email)
  if (!link) return desfazer(userId, FALHA_CRIAR)

  const membro = await admin
    .from('membros')
    .insert({ loja_id: lojaId, user_id: userId, nome: v.nomeDono, perfil: 'dono' })
  if (membro.error) return desfazer(userId, traduzir(membro.error, FALHA_CRIAR))

  return { ok: true, linkDefinirSenha: link }
}

export type DadosLoja = { planoId: string; modulos: Modulo[]; situacao: Situacao }

export async function atualizarLojaCom(deps: Dependencias, id: string, dados: DadosLoja): Promise<Resultado> {
  if (!dados.planoId) return { ok: false, erro: 'Escolha um plano' }
  const modulos = validarModulos(dados.modulos)
  if (!modulos.ok) return modulos
  if (!SITUACOES.includes(dados.situacao)) return { ok: false, erro: 'Situação inválida' }
  if (!(await deps.souAdmin())) return ACESSO_NEGADO
  // O banco deixa plano/módulos/situação só leitura enquanto há suporte aberto nesta loja
  // (`lojas_admin_atualiza` exclui `loja_em_suporte()`). A service role passaria por cima,
  // então barramos aqui também: com suporte vigente desta loja, nada é gravado.
  if ((await deps.lojaEmSuporte()) === id)
    return { ok: false, erro: 'Encerre o modo suporte desta loja antes de alterar plano, módulos ou situação.' }

  const { error } = await deps.admin
    .from('lojas')
    .update({ plano_id: dados.planoId, modulos: dados.modulos, situacao: dados.situacao })
    .eq('id', id)
  if (error) return { ok: false, erro: traduzir(error, 'Não foi possível salvar. Tente de novo.') }
  return { ok: true }
}

const esquemaPlano = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(1, 'Informe o nome do plano').max(40, 'Máximo de 40 caracteres'),
  modulos: z.array(z.enum(['servico', 'estoque', 'vendas', 'fornecedores', 'financeiro'], { message: 'Módulo inválido' })),
  limiteUsuarios: z.number({ message: 'Informe um número' }).int('Use um número inteiro').min(1, 'Deve ser no mínimo 1'),
})

export type DadosPlano = z.input<typeof esquemaPlano>

export async function salvarPlanoCom(deps: Dependencias, dados: DadosPlano): Promise<Resultado> {
  const lido = esquemaPlano.safeParse(dados)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  const modulos = validarModulos(lido.data.modulos)
  if (!modulos.ok) return modulos
  if (!(await deps.souAdmin())) return ACESSO_NEGADO

  const { id, nome, limiteUsuarios } = lido.data
  const linha = { nome, modulos: lido.data.modulos, limite_usuarios: limiteUsuarios }
  const { error } = id
    ? await deps.admin.from('planos').update(linha).eq('id', id)
    : await deps.admin.from('planos').insert(linha)
  if (error) {
    const erro = error.code === '23505' ? 'Já existe um plano com este nome' : 'Não foi possível salvar o plano. Tente de novo.'
    return { ok: false, erro }
  }
  return { ok: true }
}

/** Dono ativo mais antigo da loja (nome e e-mail), lido com a service role. */
export async function donoDaLoja(admin: SupabaseClient, lojaId: string): Promise<{ nome: string; email: string } | null> {
  const { data } = await admin
    .from('membros')
    .select('user_id, nome')
    .eq('loja_id', lojaId)
    .eq('perfil', 'dono')
    .eq('ativo', true)
    .order('criado_em')
    .limit(1)
    .maybeSingle()
  if (!data) return null
  const { data: u } = await admin.auth.admin.getUserById(data.user_id)
  if (!u.user?.email) return null
  return { nome: data.nome, email: u.user.email }
}

export async function novoLinkDonoCom(deps: Dependencias, lojaId: string): Promise<ResultadoLink> {
  if (!(await deps.souAdmin())) return ACESSO_NEGADO
  const dono = await donoDaLoja(deps.admin, lojaId)
  if (!dono) return { ok: false, erro: 'A loja não tem Dono ativo' }
  const link = await gerarLink(deps.admin, await deps.origem(), dono.email)
  if (!link) return { ok: false, erro: 'Não foi possível gerar o link. Tente de novo.' }
  return { ok: true, linkDefinirSenha: link }
}
