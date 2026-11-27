import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adicionarPecaCom, carregarPecasCom, removerPecaCom, salvarCustoPecaCom, SO_DONO_CUSTO } from '@/lib/pecas-acoes'
import type { Dependencias } from '@/lib/os'
import type { Perfil } from '@/lib/tipos'

type Resposta = { data?: unknown; error: { message: string; code?: string } | null }

function clienteFalso(respostas: Partial<Record<string, Resposta[]>> = {}, rpcs: Partial<Record<string, Resposta[]>> = {}) {
  const cadeia = (tabela: string) => {
    const proxima = () => respostas[tabela]?.shift() ?? { data: null, error: null }
    const c: Record<string, unknown> = {}
    for (const m of ['insert', 'upsert', 'update', 'delete', 'select', 'eq', 'in', 'order', 'limit']) c[m] = vi.fn(() => c)
    c.single = vi.fn(async () => proxima())
    c.maybeSingle = vi.fn(async () => proxima())
    c.then = (ok: (r: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(proxima()).then(ok, falha)
    return c
  }
  const rpc = vi.fn(async (nome: string) => rpcs[nome]?.shift() ?? { data: null, error: null })
  return { from: vi.fn(cadeia), rpc }
}
type Falso = ReturnType<typeof clienteFalso>

function deps({ supabase = clienteFalso(), perfil = 'atendente', membro = true }: { supabase?: Falso; perfil?: Perfil; membro?: boolean } = {}) {
  const d: Dependencias = {
    membroDaSessao: vi.fn(async () => (membro ? { lojaId: 'L1', perfil } : null)),
    supabase: supabase as unknown as SupabaseClient,
  }
  return d
}

function cadeias(supabase: Falso, tabela: string) {
  return supabase.from.mock.calls
    .map((c, i) => ({ tabela: c[0], cadeia: supabase.from.mock.results[i].value as Record<string, ReturnType<typeof vi.fn>> }))
    .filter((c) => c.tabela === tabela)
    .map((c) => c.cadeia)
}

const peca = { descricao: 'Tela iPhone 11', quantidade: 1, precoUnitario: 350 }

describe('lançar peça', () => {
  it('dados inválidos param antes da sessão', async () => {
    const d = deps()
    expect(await adicionarPecaCom(d, 'OS1', { ...peca, descricao: ' ' })).toEqual({ ok: false, erro: 'Descreva a peça' })
    expect(d.membroDaSessao).not.toHaveBeenCalled()
  })

  it('grava na loja da sessão, sem custo', async () => {
    const supabase = clienteFalso({ ordens_servico: [{ data: { status: 'em_servico' }, error: null }] })
    expect(await adicionarPecaCom(deps({ supabase }), 'OS1', peca)).toEqual({ ok: true })
    expect(cadeias(supabase, 'os_pecas')[0].insert).toHaveBeenCalledWith({
      loja_id: 'L1',
      os_id: 'OS1',
      descricao: 'Tela iPhone 11',
      quantidade: 1,
      preco_unitario: 350,
    })
    expect(cadeias(supabase, 'os_pecas_custo')).toHaveLength(0)
  })

  it('OS encerrada não recebe peça', async () => {
    const supabase = clienteFalso({ ordens_servico: [{ data: { status: 'devolvido' }, error: null }] })
    expect(await adicionarPecaCom(deps({ supabase }), 'OS1', peca)).toEqual({ ok: false, erro: 'A OS já foi encerrada.' })
    expect(cadeias(supabase, 'os_pecas')).toHaveLength(0)
  })

  it('a trava do orçamento enviado chega em português', async () => {
    const trava = 'O orçamento já foi enviado. Para mudar as peças, crie uma nova versão.'
    const supabase = clienteFalso({
      ordens_servico: [{ data: { status: 'aprovado' }, error: null }],
      os_pecas: [{ error: { message: trava, code: 'P0001' } }],
    })
    expect(await adicionarPecaCom(deps({ supabase }), 'OS1', peca)).toEqual({ ok: false, erro: trava })
  })

  it('remove só na loja da sessão', async () => {
    const supabase = clienteFalso({ os_pecas: [{ data: [{ id: 'P1' }], error: null }] })
    expect(await removerPecaCom(deps({ supabase }), 'P1')).toEqual({ ok: true })
    expect(cadeias(supabase, 'os_pecas')[0].eq).toHaveBeenCalledWith('loja_id', 'L1')
  })
})

describe('custo da peça', () => {
  it('atendente e técnico não gravam custo, nem chegam ao banco', async () => {
    for (const perfil of ['atendente', 'tecnico'] as const) {
      const supabase = clienteFalso()
      expect(await salvarCustoPecaCom(deps({ supabase, perfil }), 'P1', 280)).toEqual({ ok: false, erro: SO_DONO_CUSTO })
      expect(supabase.from).not.toHaveBeenCalled()
    }
  })

  it('Dono grava ou corrige o custo (upsert pela peça)', async () => {
    const supabase = clienteFalso()
    expect(await salvarCustoPecaCom(deps({ supabase, perfil: 'dono' }), 'P1', 280)).toEqual({ ok: true })
    expect(cadeias(supabase, 'os_pecas_custo')[0].upsert).toHaveBeenCalledWith(
      { peca_id: 'P1', loja_id: 'L1', custo_unitario: 280 },
      { onConflict: 'peca_id' },
    )
  })

  it('custo negativo é recusado', async () => {
    expect(await salvarCustoPecaCom(deps({ perfil: 'dono' }), 'P1', -1)).toEqual({ ok: false, erro: 'Não pode ser negativo' })
  })
})

describe('carregar peças', () => {
  const linhas: Resposta = {
    data: [
      { id: 'P1', descricao: 'Tela', quantidade: 1, preco_unitario: '350.00' },
      { id: 'P2', descricao: 'Cola', quantidade: 2, preco_unitario: '10.00' },
    ],
    error: null,
  }

  it('Dono recebe o custo e a contagem de pendências', async () => {
    const supabase = clienteFalso({
      os_pecas: [linhas],
      os_pecas_custo: [{ data: [{ peca_id: 'P1', custo_unitario: '280.00' }], error: null }],
    })
    const r = await carregarPecasCom(supabase as unknown as SupabaseClient, 'OS1', 'dono')
    expect(r.pecas.map((p) => p.custoUnitario)).toEqual([280, null])
    expect(r.semCusto).toBe(1)
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('técnico não lê custo: só a contagem vinda da função do banco', async () => {
    const supabase = clienteFalso({ os_pecas: [linhas] }, { pecas_sem_custo: [{ data: 1, error: null }] })
    const r = await carregarPecasCom(supabase as unknown as SupabaseClient, 'OS1', 'tecnico')
    expect(cadeias(supabase, 'os_pecas_custo')).toHaveLength(0)
    expect(r.pecas.every((p) => p.custoUnitario === null)).toBe(true)
    expect(r.semCusto).toBe(1)
  })

  it('OS sem peças não consulta custo', async () => {
    const supabase = clienteFalso({ os_pecas: [{ data: [], error: null }] })
    expect(await carregarPecasCom(supabase as unknown as SupabaseClient, 'OS1', 'dono')).toEqual({ pecas: [], semCusto: 0 })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
