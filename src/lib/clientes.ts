import type { SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'
import { erroDoBanco, primeiroErro, type Resultado } from '@/lib/resultado'
import { esquemaCliente } from '@/lib/validacoes'

/**
 * Regras das ações de Clientes, com as dependências injetadas para teste.
 * As Server Actions (`src/app/(loja)/clientes/acoes.ts`) só montam as dependências.
 * Ordem sempre: validar (sem rede) → conferir no servidor que é membro ativo → gravar com o
 * cliente da sessão (a RLS confere de novo, e nunca deixa o admin em suporte escrever).
 * O CPF é dado sensível: nunca vai para URL nem para log.
 */
export type Dependencias = {
  /** Loja de quem chamou, se for membro ativo dela; `null` para qualquer outro (inclusive admin em suporte). */
  membroDaSessao: () => Promise<{ lojaId: string } | null>
  /** Cliente da sessão (respeita RLS). */
  supabase: SupabaseClient
}

export type Cliente = {
  id: string
  nome: string
  telefone: string
  cpf: string | null
  email: string | null
  endereco: string | null
  nascimento: string | null
}

export type DadosCliente = z.input<typeof esquemaCliente>

export const COLUNAS_CLIENTE = 'id, nome, telefone, cpf, email, endereco, nascimento'
const ACESSO_NEGADO = { ok: false, erro: 'Acesso negado' } as const
const OK = { ok: true } as const
const LIMITE_BUSCA = 50

const vazioViraNulo = (v?: string) => (v ? v : null)

/** Telefone e CPF são guardados só com dígitos, para a busca achar com ou sem máscara. */
const soDigitos = (v: string) => v.replace(/\D/g, '')

export async function salvarClienteCom(deps: Dependencias, dados: DadosCliente, id?: string): Promise<Resultado> {
  const lido = esquemaCliente.safeParse(dados)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO

  const v = lido.data
  const telefone = soDigitos(v.telefone)
  if (!telefone) return { ok: false, erro: 'Informe o telefone' }
  const linha = {
    nome: v.nome,
    telefone,
    cpf: vazioViraNulo(v.cpf && soDigitos(v.cpf)),
    email: vazioViraNulo(v.email),
    endereco: vazioViraNulo(v.endereco),
    nascimento: vazioViraNulo(v.nascimento),
  }
  const clientes = deps.supabase.from('clientes')

  if (!id) {
    const { error } = await clientes.insert({ loja_id: membro.lojaId, ...linha })
    return error ? erroDoBanco(error) : OK
  }
  const { data, error } = await clientes.update(linha).eq('id', id).eq('loja_id', membro.lojaId).select('id').maybeSingle()
  if (error) return erroDoBanco(error)
  return data ? OK : { ok: false, erro: 'Cliente não encontrado' }
}

/** Escapa `\`, `%` e `_` para o termo valer como texto literal num `ilike`. */
function escaparCuringas(termo: string) {
  return termo.replace(/[\\%_]/g, '\\$&')
}

/**
 * Procura em nome, telefone, CPF e IMEI das OS do cliente. Termo vazio devolve os mais recentes.
 * São consultas separadas com `.ilike()` (em paralelo), unidas aqui: o `.or()` do PostgREST com o
 * valor entre aspas consome a barra do escape e faz `%`/`_` virarem curinga de novo.
 * O IMEI mora em `ordens_servico`: acha os clientes dessas OS (pela RLS) e busca esses clientes.
 * Erro do banco vira lista vazia; o termo (pode ser CPF) não vai para o log.
 */
export async function buscarClientesCom(deps: Pick<Dependencias, 'supabase'>, termo: string): Promise<Cliente[]> {
  const limpo = termo.trim()
  const clientes = () => deps.supabase.from('clientes').select(COLUNAS_CLIENTE)
  if (!limpo) {
    const { data, error } = await clientes().order('criado_em', { ascending: false }).limit(LIMITE_BUSCA)
    if (error) return resultadoDaBusca([{ data, error }])
    return (data ?? []) as Cliente[] // já vem do mais recente para o mais antigo
  }

  const padrao = `%${escaparCuringas(limpo)}%`
  // Telefone e CPF ficam só com dígitos no banco: busca pelos dígitos do termo, e sem dígitos nem consulta.
  const digitos = soDigitos(limpo)
  const padraoDigitos = `%${digitos}%`
  const [nome, os, ...porDigitos] = await Promise.all([
    clientes().ilike('nome', padrao).order('nome').limit(LIMITE_BUSCA),
    deps.supabase
      .from('ordens_servico')
      .select('cliente_id')
      .ilike('imei', padrao)
      .not('cliente_id', 'is', null)
      .order('criado_em', { ascending: false })
      .limit(LIMITE_BUSCA),
    ...(digitos
      ? [
          clientes().ilike('telefone', padraoDigitos).order('nome').limit(LIMITE_BUSCA),
          clientes().ilike('cpf', padraoDigitos).order('nome').limit(LIMITE_BUSCA),
        ]
      : []),
  ])
  const ids = [...new Set(((os.data ?? []) as { cliente_id: string }[]).map((o) => o.cliente_id))]
  const porImei = ids.length && !os.error ? [await clientes().in('id', ids).limit(LIMITE_BUSCA)] : []
  return resultadoDaBusca([nome, ...porDigitos, { data: null, error: os.error }, ...porImei])
}

type RespostaBusca = { data: unknown; error: { code?: string } | null }

/** Junta as respostas sem repetir cliente, em ordem de nome; qualquer erro do banco vira lista vazia. */
function resultadoDaBusca(respostas: RespostaBusca[]): Cliente[] {
  const falha = respostas.find((r) => r.error)
  if (falha) {
    console.error('buscarClientes: falhou', { code: falha.error?.code })
    return []
  }
  const porId = new Map<string, Cliente>()
  for (const r of respostas) for (const c of (r.data ?? []) as Cliente[]) porId.set(c.id, c)
  return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, LIMITE_BUSCA)
}
