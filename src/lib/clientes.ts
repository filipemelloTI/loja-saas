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

export async function salvarClienteCom(deps: Dependencias, dados: DadosCliente, id?: string): Promise<Resultado> {
  const lido = esquemaCliente.safeParse(dados)
  if (!lido.success) return { ok: false, erro: primeiroErro(lido.error) }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO

  const v = lido.data
  const linha = {
    nome: v.nome,
    telefone: v.telefone,
    cpf: vazioViraNulo(v.cpf),
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

/** Valor entre aspas no filtro `or` do PostgREST: vírgula, parêntese e ponto deixam de ter sentido especial. */
function entreAspas(valor: string) {
  return `"${valor.replace(/[\\"]/g, '\\$&')}"`
}

/**
 * Procura em nome, telefone, CPF e IMEI das OS do cliente. Termo vazio devolve os mais recentes.
 * O IMEI mora em `ordens_servico`: primeiro acha os clientes dessas OS (pela RLS), depois junta no filtro.
 * Erro do banco vira lista vazia; o termo (pode ser CPF) não vai para o log.
 */
export async function buscarClientesCom(deps: Pick<Dependencias, 'supabase'>, termo: string): Promise<Cliente[]> {
  const limpo = termo.trim()
  if (!limpo) {
    const { data, error } = await deps.supabase
      .from('clientes')
      .select(COLUNAS_CLIENTE)
      .order('criado_em', { ascending: false }).limit(LIMITE_BUSCA)
    return resultadoDaBusca(data, error)
  }

  const padrao = `%${escaparCuringas(limpo)}%`
  const os = await deps.supabase
    .from('ordens_servico')
    .select('cliente_id')
    .ilike('imei', padrao)
    .not('cliente_id', 'is', null)
    .limit(LIMITE_BUSCA)
  const idsPorImei = [...new Set(((os.data ?? []) as { cliente_id: string }[]).map((o) => o.cliente_id))]

  const valor = entreAspas(padrao)
  const filtros = [`nome.ilike.${valor}`, `telefone.ilike.${valor}`, `cpf.ilike.${valor}`]
  if (idsPorImei.length) filtros.push(`id.in.(${idsPorImei.join(',')})`)

  const { data, error } = await deps.supabase
    .from('clientes')
    .select(COLUNAS_CLIENTE)
    .or(filtros.join(',')).order('nome').limit(LIMITE_BUSCA)
  return resultadoDaBusca(data, error)
}

function resultadoDaBusca(data: unknown, error: { code?: string } | null): Cliente[] {
  if (error) {
    console.error('buscarClientes: falhou', { code: error.code })
    return []
  }
  return (data ?? []) as Cliente[]
}
