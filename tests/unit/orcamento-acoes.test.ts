import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  adicionarItemCom,
  aprovarOrcamentoCom,
  carregarOrcamentoCom,
  novaVersaoCom,
  ORCAMENTO_TRAVADO,
  removerItemCom,
  salvarDescontoCom,
} from '@/lib/orcamento-acoes'
import type { Dependencias } from '@/lib/os'
import { FALHA_SALVAR } from '@/lib/resultado'

type Resposta = { data?: unknown; error: { message: string; code?: string } | null }

/** Cliente falso: `from(tabela)` e `rpc(nome)` resolvem com a próxima resposta da fila. */
function clienteFalso(respostas: Partial<Record<string, Resposta[]>> = {}, rpcs: Partial<Record<string, Resposta[]>> = {}) {
  const cadeia = (tabela: string) => {
    const proxima = () => respostas[tabela]?.shift() ?? { data: null, error: null }
    const c: Record<string, unknown> = {}
    for (const m of ['insert', 'update', 'delete', 'select', 'eq', 'in', 'order', 'limit']) c[m] = vi.fn(() => c)
    c.single = vi.fn(async () => proxima())
    c.maybeSingle = vi.fn(async () => proxima())
    c.then = (ok: (r: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(proxima()).then(ok, falha)
    return c
  }
  const rpc = vi.fn(async (nome: string) => rpcs[nome]?.shift() ?? { data: null, error: null })
  return { from: vi.fn(cadeia), rpc }
}
type Falso = ReturnType<typeof clienteFalso>

function deps({ supabase = clienteFalso(), membro = true }: { supabase?: Falso; membro?: boolean } = {}) {
  const d: Dependencias = {
    membroDaSessao: vi.fn(async () => (membro ? { lojaId: 'L1', perfil: 'atendente' as const } : null)),
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

const item = { descricao: 'Troca de tela', quantidade: 1, precoUnitario: 300 }
const osAberta: Resposta = { data: { status: 'em_analise' }, error: null }

describe('adicionar item', () => {
  it('dados inválidos param antes da sessão e do banco', async () => {
    const supabase = clienteFalso()
    const d = deps({ supabase })
    expect(await adicionarItemCom(d, 'OS1', { ...item, descricao: '  ' })).toEqual({ ok: false, erro: 'Descreva o item' })
    expect(await adicionarItemCom(d, 'OS1', { ...item, quantidade: 0 })).toEqual({ ok: false, erro: 'Mínimo 1' })
    expect(await adicionarItemCom(d, 'OS1', { ...item, precoUnitario: -1 })).toEqual({ ok: false, erro: 'Não pode ser negativo' })
    expect(d.membroDaSessao).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('sem membro ativo: Acesso negado e nada é gravado', async () => {
    const supabase = clienteFalso()
    expect(await adicionarItemCom(deps({ supabase, membro: false }), 'OS1', item)).toEqual({ ok: false, erro: 'Acesso negado' })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('OS sem orçamento: cria a versão 1 na loja da sessão e lança o item nela', async () => {
    const supabase = clienteFalso({
      ordens_servico: [osAberta],
      os_orcamentos: [{ data: null, error: null }, { data: { id: 'ORC1' }, error: null }],
    })
    expect(await adicionarItemCom(deps({ supabase }), 'OS1', item)).toEqual({ ok: true })
    const [, criacao] = cadeias(supabase, 'os_orcamentos')
    expect(criacao.insert).toHaveBeenCalledWith({ loja_id: 'L1', os_id: 'OS1' })
    const [insercao] = cadeias(supabase, 'os_orcamento_itens')
    expect(insercao.insert).toHaveBeenCalledWith({
      orcamento_id: 'ORC1',
      loja_id: 'L1',
      descricao: 'Troca de tela',
      quantidade: 1,
      preco_unitario: 300,
      servico_id: null,
    })
  })

  it('orçamento em rascunho: lança no que existe, sem criar outro', async () => {
    const supabase = clienteFalso({
      ordens_servico: [osAberta],
      os_orcamentos: [{ data: { id: 'ORC1', status: 'rascunho' }, error: null }],
    })
    expect(await adicionarItemCom(deps({ supabase }), 'OS1', item)).toEqual({ ok: true })
    expect(cadeias(supabase, 'os_orcamentos')).toHaveLength(1)
    expect(cadeias(supabase, 'os_orcamento_itens')[0].insert).toHaveBeenCalled()
  })

  it('orçamento já enviado: pede nova versão e não grava', async () => {
    const supabase = clienteFalso({
      ordens_servico: [osAberta],
      os_orcamentos: [{ data: { id: 'ORC1', status: 'enviado' }, error: null }],
    })
    expect(await adicionarItemCom(deps({ supabase }), 'OS1', item)).toEqual({ ok: false, erro: ORCAMENTO_TRAVADO })
    expect(cadeias(supabase, 'os_orcamento_itens')).toHaveLength(0)
  })

  it('OS encerrada não recebe item', async () => {
    const supabase = clienteFalso({ ordens_servico: [{ data: { status: 'entregue' }, error: null }] })
    expect(await adicionarItemCom(deps({ supabase }), 'OS1', item)).toEqual({ ok: false, erro: 'A OS já foi encerrada.' })
    expect(cadeias(supabase, 'os_orcamentos')).toHaveLength(0)
  })

  it('erro do banco que não é P0001 vira mensagem genérica', async () => {
    const supabase = clienteFalso({
      ordens_servico: [osAberta],
      os_orcamentos: [{ data: { id: 'ORC1', status: 'rascunho' }, error: null }],
      os_orcamento_itens: [{ error: { message: 'violates foreign key', code: '23503' } }],
    })
    expect(await adicionarItemCom(deps({ supabase }), 'OS1', item)).toEqual({ ok: false, erro: FALHA_SALVAR })
  })
})

describe('remover item e desconto', () => {
  it('remove só na loja da sessão', async () => {
    const supabase = clienteFalso({ os_orcamento_itens: [{ data: [{ id: 'I1' }], error: null }] })
    expect(await removerItemCom(deps({ supabase }), 'I1')).toEqual({ ok: true })
    expect(cadeias(supabase, 'os_orcamento_itens')[0].eq).toHaveBeenCalledWith('loja_id', 'L1')
  })

  it('a trava do banco chega à tela em português', async () => {
    const supabase = clienteFalso({ os_orcamento_itens: [{ error: { message: ORCAMENTO_TRAVADO, code: 'P0001' } }] })
    expect(await removerItemCom(deps({ supabase }), 'I1')).toEqual({ ok: false, erro: ORCAMENTO_TRAVADO })
  })

  it('desconto em percentual grava só o percentual', async () => {
    const supabase = clienteFalso({ os_orcamentos: [{ data: [{ id: 'ORC1' }], error: null }] })
    expect(await salvarDescontoCom(deps({ supabase }), 'ORC1', { tipo: 'percentual', valor: 10 })).toEqual({ ok: true })
    expect(cadeias(supabase, 'os_orcamentos')[0].update).toHaveBeenCalledWith({ desconto_valor: null, desconto_percentual: 10 })
  })

  it('sem desconto limpa os dois', async () => {
    const supabase = clienteFalso({ os_orcamentos: [{ data: [{ id: 'ORC1' }], error: null }] })
    await salvarDescontoCom(deps({ supabase }), 'ORC1', { tipo: 'nenhum' })
    expect(cadeias(supabase, 'os_orcamentos')[0].update).toHaveBeenCalledWith({ desconto_valor: null, desconto_percentual: null })
  })

  it('percentual acima de 100 é recusado antes do banco', async () => {
    const supabase = clienteFalso()
    expect(await salvarDescontoCom(deps({ supabase }), 'ORC1', { tipo: 'percentual', valor: 150 })).toEqual({
      ok: false,
      erro: 'Máximo 100%',
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('aprovar e nova versão', () => {
  it('aprovação sem nome não chama o banco', async () => {
    const supabase = clienteFalso()
    expect(await aprovarOrcamentoCom(deps({ supabase }), 'ORC1', { por: ' ', meio: 'balcao' })).toEqual({
      ok: false,
      erro: 'Informe quem aprovou',
    })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('aprovação válida chama a função do banco com nome aparado e meio', async () => {
    const supabase = clienteFalso()
    expect(await aprovarOrcamentoCom(deps({ supabase }), 'ORC1', { por: ' Ana ', meio: 'telefone' })).toEqual({ ok: true })
    expect(supabase.rpc).toHaveBeenCalledWith('aprovar_orcamento_os', { orc: 'ORC1', por: 'Ana', meio: 'telefone' })
  })

  it('concorrência: a mensagem do banco chega como veio', async () => {
    const mudou = 'O orçamento mudou enquanto você olhava. Recarregue a tela e tente de novo.'
    const supabase = clienteFalso({}, { editar_orcamento_os: [{ error: { message: mudou, code: 'P0001' } }] })
    expect(await novaVersaoCom(deps({ supabase }), 'ORC1')).toEqual({ ok: false, erro: mudou })
  })

  it('sem membro ativo, nenhuma função do banco é chamada', async () => {
    const supabase = clienteFalso()
    expect(await novaVersaoCom(deps({ supabase, membro: false }), 'ORC1')).toEqual({ ok: false, erro: 'Acesso negado' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

describe('carregar orçamento', () => {
  it('a versão mais nova vale; as outras ficam como anteriores; números viram number', async () => {
    const supabase = clienteFalso({
      os_orcamentos: [
        {
          data: [
            { id: 'ORC2', versao: 2, status: 'rascunho', desconto_valor: '10.00', desconto_percentual: null },
            { id: 'ORC1', versao: 1, status: 'substituido', desconto_valor: null, desconto_percentual: null },
          ],
          error: null,
        },
      ],
      os_pecas: [{ data: [{ descricao: 'Tela', quantidade: 1, preco_unitario: '350.00' }], error: null }],
      os_orcamento_itens: [{ data: [{ id: 'I1', descricao: 'Mão de obra', quantidade: 1, preco_unitario: '300.00' }], error: null }],
    })
    const r = await carregarOrcamentoCom(supabase as unknown as SupabaseClient, 'OS1')
    expect(r.atual?.id).toBe('ORC2')
    expect(r.atual?.descontoValor).toBe(10)
    expect(r.atual?.itens).toEqual([{ id: 'I1', descricao: 'Mão de obra', quantidade: 1, precoUnitario: 300 }])
    expect(r.anteriores).toEqual([{ versao: 1, status: 'substituido' }])
    expect(r.pecas).toEqual([{ descricao: 'Tela', quantidade: 1, precoUnitario: 350 }])
  })

  it('OS sem orçamento: atual nulo', async () => {
    const supabase = clienteFalso({ os_orcamentos: [{ data: [], error: null }], os_pecas: [{ data: [], error: null }] })
    expect(await carregarOrcamentoCom(supabase as unknown as SupabaseClient, 'OS1')).toEqual({ atual: null, anteriores: [], pecas: [] })
  })
})
