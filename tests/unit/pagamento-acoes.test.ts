import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { registrarPagamentoCom, removerPagamentoCom, SEM_ORCAMENTO, SO_DONO_PAGAMENTO } from '@/lib/pagamento-acoes'
import type { Dependencias } from '@/lib/os'
import type { Perfil } from '@/lib/tipos'

type Resposta = { data?: unknown; error: { message: string; code?: string } | null }

function clienteFalso(respostas: Partial<Record<string, Resposta[]>> = {}) {
  const cadeia = (tabela: string) => {
    const proxima = () => respostas[tabela]?.shift() ?? { data: null, error: null }
    const c: Record<string, unknown> = {}
    for (const m of ['insert', 'update', 'delete', 'select', 'eq', 'in', 'order', 'limit']) c[m] = vi.fn(() => c)
    c.single = vi.fn(async () => proxima())
    c.maybeSingle = vi.fn(async () => proxima())
    c.then = (ok: (r: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(proxima()).then(ok, falha)
    return c
  }
  return { from: vi.fn(cadeia), rpc: vi.fn() }
}
type Falso = ReturnType<typeof clienteFalso>

function deps({ supabase = clienteFalso(), perfil = 'atendente' }: { supabase?: Falso; perfil?: Perfil } = {}) {
  const d: Dependencias = {
    membroDaSessao: vi.fn(async () => ({ lojaId: 'L1', perfil })),
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

/** OS com orçamento de 300 + peça de 350 = 650, e os pagamentos já lançados. */
function cenario(status: string, pagos: number[], semOrcamento = false) {
  return clienteFalso({
    ordens_servico: [{ data: { status }, error: null }],
    os_orcamentos: [
      {
        data: semOrcamento
          ? []
          : [{ id: 'ORC1', versao: 1, status: 'aprovado', desconto_valor: null, desconto_percentual: null }],
        error: null,
      },
    ],
    os_pecas: [{ data: semOrcamento ? [] : [{ descricao: 'Tela', quantidade: 1, preco_unitario: '350.00' }], error: null }],
    os_orcamento_itens: [{ data: [{ id: 'I1', descricao: 'Mão de obra', quantidade: 1, preco_unitario: '300.00' }], error: null }],
    os_pagamentos: [
      { data: pagos.map((v, i) => ({ id: `P${i}`, tipo: 'sinal', forma: 'pix', parcelas: null, valor: v, registrado_em: '' })), error: null },
    ],
  })
}

describe('registrar pagamento', () => {
  it('crédito sem parcelas e parcelas fora do crédito param antes do banco', async () => {
    const d = deps()
    expect(await registrarPagamentoCom(d, 'OS1', { forma: 'credito', valor: 100 })).toEqual({
      ok: false,
      erro: 'Informe em quantas parcelas',
    })
    expect(await registrarPagamentoCom(d, 'OS1', { forma: 'pix', parcelas: 2, valor: 100 })).toEqual({
      ok: false,
      erro: 'Parcelas só no crédito',
    })
    expect(await registrarPagamentoCom(d, 'OS1', { forma: 'pix', valor: 0 })).toEqual({
      ok: false,
      erro: 'O valor precisa ser maior que zero',
    })
    expect(d.membroDaSessao).not.toHaveBeenCalled()
  })

  it('antes de a OS ficar pronta, entra como sinal', async () => {
    const supabase = cenario('aprovado', [])
    expect(await registrarPagamentoCom(deps({ supabase }), 'OS1', { forma: 'pix', valor: 300 })).toEqual({ ok: true })
    const insercao = cadeias(supabase, 'os_pagamentos').find((c) => c.insert.mock.calls.length)!
    expect(insercao.insert).toHaveBeenCalledWith({
      loja_id: 'L1',
      os_id: 'OS1',
      tipo: 'sinal',
      forma: 'pix',
      parcelas: null,
      valor: 300,
    })
  })

  it('com a OS pronta, entra como final, com as parcelas do crédito', async () => {
    const supabase = cenario('pronto', [300])
    expect(await registrarPagamentoCom(deps({ supabase }), 'OS1', { forma: 'credito', parcelas: 2, valor: 350 })).toEqual({ ok: true })
    const insercao = cadeias(supabase, 'os_pagamentos').find((c) => c.insert.mock.calls.length)!
    expect(insercao.insert).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'final', forma: 'credito', parcelas: 2, valor: 350 }))
  })

  it('não deixa passar do total e diz quanto falta', async () => {
    const supabase = cenario('pronto', [300])
    const r = await registrarPagamentoCom(deps({ supabase }), 'OS1', { forma: 'pix', valor: 400 })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.erro.replace(/ /g, ' ')).toBe('O total pago não pode passar de R$ 650,00. Falta R$ 350,00.')
    expect(cadeias(supabase, 'os_pagamentos').some((c) => c.insert.mock.calls.length)).toBe(false)
  })

  it('OS já paga recusa qualquer valor', async () => {
    const supabase = cenario('pronto', [300, 350])
    expect(await registrarPagamentoCom(deps({ supabase }), 'OS1', { forma: 'pix', valor: 1 })).toEqual({
      ok: false,
      erro: 'Esta OS já está paga.',
    })
  })

  it('sem orçamento não há o que pagar', async () => {
    const supabase = cenario('aberta', [], true)
    expect(await registrarPagamentoCom(deps({ supabase }), 'OS1', { forma: 'pix', valor: 10 })).toEqual({ ok: false, erro: SEM_ORCAMENTO })
  })

  it('OS encerrada não recebe pagamento', async () => {
    const supabase = clienteFalso({ ordens_servico: [{ data: { status: 'entregue' }, error: null }] })
    expect(await registrarPagamentoCom(deps({ supabase }), 'OS1', { forma: 'pix', valor: 10 })).toEqual({
      ok: false,
      erro: 'A OS já foi encerrada.',
    })
  })
})

describe('remover pagamento', () => {
  it('atendente não remove, nem chega ao banco', async () => {
    const supabase = clienteFalso()
    expect(await removerPagamentoCom(deps({ supabase }), 'P1')).toEqual({ ok: false, erro: SO_DONO_PAGAMENTO })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('Dono remove na loja da sessão', async () => {
    const supabase = clienteFalso({ os_pagamentos: [{ data: [{ id: 'P1' }], error: null }] })
    expect(await removerPagamentoCom(deps({ supabase, perfil: 'dono' }), 'P1')).toEqual({ ok: true })
    expect(cadeias(supabase, 'os_pagamentos')[0].eq).toHaveBeenCalledWith('loja_id', 'L1')
  })
})
