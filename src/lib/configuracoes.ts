import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { montarLinkDefinirSenha } from '@/lib/auth-links'
import { MENSAGEM_PADRAO, eventoValido } from '@/lib/mensagens'
import { FALHA_SALVAR, erroDoBanco, primeiroErro, type Resultado } from '@/lib/resultado'
import { FORMAS_PAGAMENTO } from '@/lib/rotulos'
import { esquemaConfigLoja, esquemaEdicaoMembro, esquemaMembro, esquemaServico } from '@/lib/validacoes'

/**
 * Regras das ações de Configurações (Dono), com as dependências injetadas para teste.
 * As Server Actions (`src/app/(loja)/configuracoes/acoes.ts`) só montam as dependências.
 * Ordem sempre: validar (sem rede) → conferir no servidor que é Dono ativo (não suporte) → gravar.
 * As gravações usam o cliente da sessão (a RLS confere de novo); só criar usuário e gerar
 * link de senha usam a service role.
 */
export type Dependencias = {
  /** Loja de quem chamou, se for Dono ativo dela; `null` para qualquer outro (inclusive admin em suporte). */
  donoDaSessao: () => Promise<{ lojaId: string } | null>
  /** Cliente da sessão (respeita RLS). */
  supabase: SupabaseClient
  /** Cliente com service role: só para Auth e para incluir membros. */
  admin: SupabaseClient
  /** Origem do site para montar o link de definir senha. */
  origem: () => Promise<string>
}

export type ResultadoLink = { ok: true; linkDefinirSenha: string } | { ok: false; erro: string }

// Vivem em `resultado.ts` (compartilhados entre módulos); reexportados para quem já importa daqui.
export { FALHA_SALVAR, erroDoBanco, type Resultado }

const ACESSO_NEGADO = { ok: false, erro: 'Acesso negado' } as const
const NAO_ENCONTRADO = { ok: false, erro: 'Usuário não encontrado' } as const
const OK = { ok: true } as const

/** Grava e devolve o resultado: erro do banco mapeado ou ok. */
async function gravar(consulta: PromiseLike<{ error: { code?: string; message: string } | null }>): Promise<Resultado> {
  const { error } = await consulta
  return error ? erroDoBanco(error) : OK
}

const textoOpcional = (max: number, rotulo: string) =>
  z.string().trim().max(max, `${rotulo}: máximo de ${max} caracteres`).optional()

// Loja -------------------------------------------------------------------

const esquemaDadosLoja = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da loja').max(80, 'Nome: máximo de 80 caracteres'),
  cnpj: textoOpcional(20, 'CNPJ'),
  endereco: textoOpcional(200, 'Endereço'),
  telefone: textoOpcional(20, 'Telefone'),
  textoTermos: textoOpcional(5000, 'Termos'),
})
export type DadosLoja = z.input<typeof esquemaDadosLoja>

const vazioViraNulo = (v?: string) => (v ? v : null)

export async function salvarDadosLojaCom(deps: Dependencias, dados: DadosLoja): Promise<Resultado> {
  const lido = esquemaDadosLoja.safeParse(dados)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO

  const v = lido.data
  const loja = await gravar(deps.supabase.from('lojas').update({ nome: v.nome }).eq('id', dono.lojaId))
  if (!loja.ok) return loja
  return gravar(
    deps.supabase
      .from('config_loja')
      .update({
        cnpj: vazioViraNulo(v.cnpj),
        endereco: vazioViraNulo(v.endereco),
        telefone: vazioViraNulo(v.telefone),
        texto_termos: vazioViraNulo(v.textoTermos),
      })
      .eq('loja_id', dono.lojaId),
  )
}

export const TIPOS_LOGO: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
export const TAMANHO_MAXIMO_LOGO = 1024 * 1024

export async function enviarLogoCom(deps: Dependencias, form: FormData): Promise<Resultado> {
  const arquivo = form.get('logo')
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: 'Escolha uma imagem' }
  const ext = TIPOS_LOGO[arquivo.type]
  if (!ext) return { ok: false, erro: 'Use uma imagem PNG, JPG ou WebP' }
  if (arquivo.size > TAMANHO_MAXIMO_LOGO) return { ok: false, erro: 'A logo pode ter no máximo 1 MB' }
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO

  const caminho = `${dono.lojaId}/logo.${ext}`
  const bucket = deps.supabase.storage.from('logos')
  const envio = await bucket.upload(caminho, arquivo, { upsert: true, contentType: arquivo.type })
  if (envio.error) return { ok: false, erro: FALHA_SALVAR }

  const salvo = await gravar(deps.supabase.from('config_loja').update({ logo_path: caminho }).eq('loja_id', dono.lojaId))
  if (!salvo.ok) return salvo
  // Logo antiga com outra extensão: some para não ficar arquivo solto.
  const antigas = Object.values(TIPOS_LOGO).filter((e) => e !== ext).map((e) => `${dono.lojaId}/logo.${e}`)
  await bucket.remove(antigas)
  return OK
}

// Usuários ---------------------------------------------------------------

function lerNumero(valor: FormDataEntryValue | null): number | undefined {
  const texto = String(valor ?? '').trim().replace(',', '.')
  return texto === '' ? undefined : Number(texto)
}

export async function adicionarUsuarioCom(deps: Dependencias, form: FormData): Promise<ResultadoLink> {
  const lido = esquemaMembro.safeParse({
    nome: String(form.get('nome') ?? ''),
    email: String(form.get('email') ?? ''),
    perfil: String(form.get('perfil') ?? ''),
    comissao: lerNumero(form.get('comissao')),
  })
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO

  const v = lido.data
  const email = v.email.toLowerCase()
  const { admin } = deps

  const usuario = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { nome: v.nome } })
  if (usuario.error || !usuario.data.user) {
    return { ok: false, erro: usuario.error?.code === 'email_exists' ? 'Já existe um usuário com este e-mail' : FALHA_SALVAR }
  }
  const userId = usuario.data.user.id
  // Apagar o usuário do Auth leva junto o membro e a comissão (cascade).
  const desfazer = async (erro: { ok: false; erro: string }) => {
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) console.error('adicionarUsuario: não apagou o usuário do Auth', { userId })
    return erro
  }

  const membro = await admin
    .from('membros')
    .insert({ loja_id: dono.lojaId, user_id: userId, nome: v.nome, perfil: v.perfil })
    .select('id')
    .single()
  if (membro.error || !membro.data) return desfazer(erroDoBanco(membro.error ?? { message: '' }))
  const membroId = (membro.data as { id: string }).id

  if (v.comissao !== undefined) {
    const { error } = await admin
      .from('comissoes_membro')
      .insert({ membro_id: membroId, loja_id: dono.lojaId, percentual: v.comissao })
    if (error) return desfazer(erroDoBanco(error))
  }

  const link = await gerarLink(admin, await deps.origem(), email)
  if (!link) return desfazer({ ok: false, erro: FALHA_SALVAR })
  return { ok: true, linkDefinirSenha: link }
}

async function gerarLink(admin: SupabaseClient, origem: string, email: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  const token = data?.properties?.hashed_token
  if (error || !token) return null
  return montarLinkDefinirSenha(origem, token)
}

export type EdicaoUsuario = z.input<typeof esquemaEdicaoMembro>

export async function atualizarUsuarioCom(deps: Dependencias, id: string, dados: EdicaoUsuario): Promise<Resultado> {
  const lido = esquemaEdicaoMembro.safeParse(dados)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO

  const v = lido.data
  const membro = await deps.supabase
    .from('membros')
    .update({ perfil: v.perfil, ativo: v.ativo })
    .eq('id', id)
    .eq('loja_id', dono.lojaId)
    .select('id')
    .maybeSingle()
  if (membro.error) return erroDoBanco(membro.error)
  if (!membro.data) return NAO_ENCONTRADO

  const comissoes = deps.supabase.from('comissoes_membro')
  return gravar(
    v.comissao === null
      ? comissoes.delete().eq('membro_id', id).eq('loja_id', dono.lojaId)
      : comissoes.upsert({ membro_id: id, loja_id: dono.lojaId, percentual: v.comissao }),
  )
}

export async function gerarLinkSenhaCom(deps: Dependencias, membroId: string): Promise<ResultadoLink> {
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO
  const { data } = await deps.admin
    .from('membros')
    .select('user_id')
    .eq('id', membroId)
    .eq('loja_id', dono.lojaId)
    .maybeSingle()
  if (!data) return NAO_ENCONTRADO
  const { data: u } = await deps.admin.auth.admin.getUserById((data as { user_id: string }).user_id)
  if (!u.user?.email) return NAO_ENCONTRADO
  const link = await gerarLink(deps.admin, await deps.origem(), u.user.email)
  if (!link) return { ok: false, erro: 'Não foi possível gerar o link. Tente de novo.' }
  return { ok: true, linkDefinirSenha: link }
}

// Catálogo de serviços -----------------------------------------------------

export type DadosServico = z.input<typeof esquemaServico> & { id?: string }

export async function salvarServicoCom(deps: Dependencias, dados: DadosServico): Promise<Resultado> {
  const lido = esquemaServico.safeParse(dados)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO

  const v = lido.data
  const linha = { nome: v.nome, preco: v.preco, garantia_dias: v.garantiaDias ?? null }
  const servicos = deps.supabase.from('servicos')
  const salvo = dados.id
    ? await servicos.update(linha).eq('id', dados.id).eq('loja_id', dono.lojaId).select('id').maybeSingle()
    : await servicos.insert({ loja_id: dono.lojaId, ...linha }).select('id').single()
  if (salvo.error) return erroDoBanco(salvo.error)
  if (!salvo.data) return { ok: false, erro: 'Serviço não encontrado' }

  const servicoId = (salvo.data as { id: string }).id
  return gravar(
    deps.supabase
      .from('servicos_custo')
      .upsert({ servico_id: servicoId, loja_id: dono.lojaId, custo_peca_estimado: v.custo }),
  )
}

export async function alternarServicoCom(deps: Dependencias, id: string, ativo: boolean): Promise<Resultado> {
  if (typeof ativo !== 'boolean') return { ok: false, erro: 'Dados inválidos' }
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO
  return gravar(deps.supabase.from('servicos').update({ ativo }).eq('id', id).eq('loja_id', dono.lojaId))
}

// Mensagens do WhatsApp ----------------------------------------------------

const textoMensagem = z.string().trim().min(1, 'A mensagem não pode ficar vazia').max(1000, 'Máximo de 1000 caracteres')

export async function salvarMensagemCom(deps: Dependencias, evento: string, texto: string): Promise<Resultado> {
  if (!eventoValido(evento)) return { ok: false, erro: 'Evento inválido' }
  const lido = textoMensagem.safeParse(texto)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO
  return gravar(
    deps.supabase.from('mensagens_padrao').update({ texto: lido.data }).eq('loja_id', dono.lojaId).eq('evento', evento),
  )
}

export async function restaurarMensagemPadraoCom(deps: Dependencias, evento: string): Promise<Resultado> {
  if (!eventoValido(evento)) return { ok: false, erro: 'Evento inválido' }
  return salvarMensagemCom(deps, evento, MENSAGEM_PADRAO[evento])
}

// Garantia -----------------------------------------------------------------

const esquemaGarantia = esquemaConfigLoja.pick({
  garantiaServicoDias: true,
  garantiaNovoDias: true,
  garantiaSeminovoDias: true,
  garantiaAcessorioDias: true,
})
export type DadosGarantia = z.input<typeof esquemaGarantia>

export async function salvarGarantiaCom(deps: Dependencias, dados: DadosGarantia): Promise<Resultado> {
  const lido = esquemaGarantia.safeParse(dados)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO
  const v = lido.data
  return gravar(
    deps.supabase
      .from('config_loja')
      .update({
        garantia_servico_dias: v.garantiaServicoDias,
        garantia_novo_dias: v.garantiaNovoDias,
        garantia_seminovo_dias: v.garantiaSeminovoDias,
        garantia_acessorio_dias: v.garantiaAcessorioDias,
      })
      .eq('loja_id', dono.lojaId),
  )
}

// Listas ordenadas (condições de garantia, checklist) ----------------------

const idOpcional = z.string().min(1).optional()

const esquemaCondicoes = z
  .array(z.object({ id: idOpcional, texto: z.string().trim().min(1, 'Preencha ou remova a condição vazia').max(200, 'Condição: máximo de 200 caracteres') }))
  .max(50, 'Máximo de 50 condições')
export type Condicao = z.input<typeof esquemaCondicoes>[number]

/** Salva a lista inteira: o que saiu da lista é apagado; a ordem é a posição. */
export async function salvarCondicoesCom(deps: Dependencias, lista: Condicao[]): Promise<Resultado> {
  const lido = esquemaCondicoes.safeParse(lista)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO

  const tabela = () => deps.supabase.from('condicoes_garantia')
  const mantidas = lido.data.flatMap((c) => (c.id ? [c.id] : []))
  const remover = tabela().delete().eq('loja_id', dono.lojaId)
  const removido = await gravar(mantidas.length ? remover.not('id', 'in', `(${mantidas.join(',')})`) : remover)
  if (!removido.ok) return removido

  for (const [ordem, c] of lido.data.entries()) {
    const r = await gravar(
      c.id
        ? tabela().update({ texto: c.texto, ordem }).eq('id', c.id).eq('loja_id', dono.lojaId)
        : tabela().insert({ loja_id: dono.lojaId, texto: c.texto, ordem }),
    )
    if (!r.ok) return r
  }
  return OK
}

const esquemaChecklist = z
  .array(
    z.object({
      id: idOpcional,
      nome: z.string().trim().min(1, 'Preencha o nome do item').max(80, 'Item: máximo de 80 caracteres'),
      ativo: z.boolean(),
    }),
  )
  .max(100, 'Máximo de 100 itens')
export type ItemChecklist = z.input<typeof esquemaChecklist>[number]

/** Salva a lista inteira: itens não são apagados (OS antigas usam), só desativados. A ordem é a posição. */
export async function salvarChecklistCom(deps: Dependencias, lista: ItemChecklist[]): Promise<Resultado> {
  const lido = esquemaChecklist.safeParse(lista)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO

  const tabela = () => deps.supabase.from('checklist_itens')
  for (const [ordem, item] of lido.data.entries()) {
    const linha = { nome: item.nome, ativo: item.ativo, ordem }
    const r = await gravar(
      item.id
        ? tabela().update(linha).eq('id', item.id).eq('loja_id', dono.lojaId)
        : tabela().insert({ loja_id: dono.lojaId, ...linha }),
    )
    if (!r.ok) return r
  }
  return OK
}

// Vendas e OS --------------------------------------------------------------

const esquemaVendasOS = esquemaConfigLoja
  .pick({
    orcamentoAlertaDias: true,
    taxaAvaliacaoAtiva: true,
    taxaAvaliacaoValor: true,
    osNumeroInicial: true,
    vendaNumeroInicial: true,
    donoGeraComissao: true,
    tecnicoVePropriaComissao: true,
  })
  .extend({
    formasPagamento: z
      .array(z.enum(Object.keys(FORMAS_PAGAMENTO) as [keyof typeof FORMAS_PAGAMENTO], { message: 'Forma de pagamento inválida' }))
      .min(1, 'Escolha pelo menos uma forma de pagamento'),
  })
export type DadosVendasOS = z.input<typeof esquemaVendasOS>

export async function salvarConfigVendasOSCom(deps: Dependencias, dados: DadosVendasOS): Promise<Resultado> {
  const lido = esquemaVendasOS.safeParse(dados)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO
  const v = lido.data
  return gravar(
    deps.supabase
      .from('config_loja')
      .update({
        orcamento_alerta_dias: v.orcamentoAlertaDias,
        taxa_avaliacao_ativa: v.taxaAvaliacaoAtiva,
        taxa_avaliacao_valor: v.taxaAvaliacaoValor,
        os_numero_inicial: v.osNumeroInicial,
        venda_numero_inicial: v.vendaNumeroInicial,
        formas_pagamento: v.formasPagamento,
        dono_gera_comissao: v.donoGeraComissao,
        tecnico_ve_propria_comissao: v.tecnicoVePropriaComissao,
      })
      .eq('loja_id', dono.lojaId),
  )
}

// Acesso de suporte ------------------------------------------------------

/** Durações, em horas, que o Dono pode liberar para o suporte entrar. */
export const HORAS_SUPORTE = [24, 72] as const
export type HorasSuporte = (typeof HORAS_SUPORTE)[number]

const MS_POR_HORA = 60 * 60 * 1000

/**
 * O Dono libera acesso de suporte à própria loja por um tempo limitado.
 * A RLS só deixa o Dono ativo (não suporte) inserir para a própria loja; `concedido_por`
 * vem do default `auth.uid()`. O mais recente vale: não é preciso apagar os antigos.
 */
export async function liberarSuporteCom(deps: Dependencias, horas: number): Promise<Resultado> {
  if (!(HORAS_SUPORTE as readonly number[]).includes(horas)) return { ok: false, erro: 'Duração de suporte inválida' }
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO
  const expira = new Date(Date.now() + horas * MS_POR_HORA).toISOString()
  return gravar(deps.supabase.from('acessos_suporte').insert({ loja_id: dono.lojaId, expira_em: expira }))
}

/** O Dono encerra o acesso de suporte vigente da própria loja: faz expirar agora. */
export async function encerrarSuporteCom(deps: Dependencias): Promise<Resultado> {
  const dono = await deps.donoDaSessao()
  if (!dono) return ACESSO_NEGADO
  const agora = new Date().toISOString()
  return gravar(
    deps.supabase.from('acessos_suporte').update({ expira_em: agora }).eq('loja_id', dono.lojaId).gt('expira_em', agora),
  )
}
