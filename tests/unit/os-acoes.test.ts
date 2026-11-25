import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { abrirOSCom, carregarOSCom, listarOSCom, mudarStatusCom, salvarLaudoCom, type DadosNovaOS, type Dependencias } from '@/lib/os'
import { FALHA_SALVAR } from '@/lib/resultado'
import type { Perfil } from '@/lib/tipos'

type Resposta = { data?: unknown; error: { message: string; code?: string } | null }

/** Cliente falso: `from(tabela)` e `rpc(nome)` resolvem com a próxima resposta da fila (por tabela ou função). */
function clienteFalso(
  respostas: Partial<Record<string, Resposta[]>> = {},
  rpcs: Partial<Record<string, Resposta[]>> = {},
) {
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

function deps({ supabase = clienteFalso(), perfil = 'dono', membro = true }: { supabase?: Falso; perfil?: Perfil; membro?: boolean } = {}) {
  const d: Dependencias = {
    membroDaSessao: vi.fn(async () => (membro ? { lojaId: 'L1', perfil } : null)),
    supabase: supabase as unknown as SupabaseClient,
  }
  return d
}

/** Todas as cadeias criadas para uma tabela, na ordem das chamadas a `from`. */
function cadeias(supabase: Falso, tabela: string) {
  return supabase.from.mock.calls
    .map((c, i) => ({ tabela: c[0], cadeia: supabase.from.mock.results[i].value as Record<string, ReturnType<typeof vi.fn>> }))
    .filter((c) => c.tabela === tabela)
    .map((c) => c.cadeia)
}

const nova: DadosNovaOS = {
  interna: false,
  clienteId: 'C1',
  aparelhoTipo: 'celular',
  defeitoRelatado: 'Não liga',
  checklist: [
    { nome: 'Tela trincada', marcado: true },
    { nome: 'Câmera', marcado: false, observacao: 'riscada' },
  ],
}
const osCriada: Resposta = { data: { id: 'OS1', numero: 7 }, error: null }

describe('abrirOS', () => {
  it('dados inválidos param antes de tocar sessão e banco', async () => {
    const supabase = clienteFalso()
    const d = deps({ supabase })
    const r = await abrirOSCom(d, { ...nova, defeitoRelatado: ' ' })
    expect(r).toEqual({ ok: false, erro: 'Descreva o defeito' })
    expect(d.membroDaSessao).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('sem membro ativo: Acesso negado e nada é gravado', async () => {
    const supabase = clienteFalso()
    const r = await abrirOSCom(deps({ supabase, membro: false }), nova)
    expect(r).toEqual({ ok: false, erro: 'Acesso negado' })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('grava na loja da sessão, ignorando loja_id vindo do chamador, e devolve id e número', async () => {
    const supabase = clienteFalso({ ordens_servico: [osCriada] })
    const r = await abrirOSCom(deps({ supabase }), { ...nova, loja_id: 'L-OUTRA' } as typeof nova)
    expect(r).toEqual({ ok: true, id: 'OS1', numero: 7 })
    const [insercao] = cadeias(supabase, 'ordens_servico')
    expect(insercao.insert).toHaveBeenCalledWith(
      expect.objectContaining({ loja_id: 'L1', cliente_id: 'C1', defeito_relatado: 'Não liga', marca: null }),
    )
    expect(insercao.insert.mock.calls[0][0]).not.toHaveProperty('loja_id', 'L-OUTRA')
  })

  it('checklist vai como cópia: só nomes, sem ids de item, na loja da sessão', async () => {
    const supabase = clienteFalso({ ordens_servico: [osCriada] })
    await abrirOSCom(deps({ supabase }), nova)
    const [c] = cadeias(supabase, 'os_checklist')
    expect(c.insert).toHaveBeenCalledWith([
      { os_id: 'OS1', loja_id: 'L1', nome: 'Tela trincada', marcado: true, observacao: null },
      { os_id: 'OS1', loja_id: 'L1', nome: 'Câmera', marcado: false, observacao: 'riscada' },
    ])
    expect(supabase.from).not.toHaveBeenCalledWith('checklist_itens')
  })

  it('com senha: chama guardar_senha_aparelho com a senha como parâmetro, nunca em outra tabela', async () => {
    const supabase = clienteFalso({ ordens_servico: [osCriada] })
    const r = await abrirOSCom(deps({ supabase }), { ...nova, senhaAparelho: '1234' })
    expect(r.ok).toBe(true)
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith('guardar_senha_aparelho', { os: 'OS1', senha: '1234' })
    expect(JSON.stringify(supabase.from.mock.results.map((x) => (x.value as { insert: { mock: unknown } }).insert.mock))).not.toContain('1234')
  })

  it('sem senha: o rpc não é chamado', async () => {
    for (const senhaAparelho of [undefined, '']) {
      const supabase = clienteFalso({ ordens_servico: [osCriada] })
      const r = await abrirOSCom(deps({ supabase }), { ...nova, senhaAparelho })
      expect(r.ok).toBe(true)
      expect(supabase.rpc).not.toHaveBeenCalled()
    }
  })

  it('falha ao guardar a senha: erro genérico (sem a senha) e a OS recém-criada é apagada', async () => {
    const supabase = clienteFalso(
      { ordens_servico: [osCriada] },
      { guardar_senha_aparelho: [{ error: { message: 'falhou com 1234', code: '42501' } }] },
    )
    const r = await abrirOSCom(deps({ supabase }), { ...nova, senhaAparelho: '1234' })
    expect(r).toEqual({ ok: false, erro: FALHA_SALVAR })
    const apagar = cadeias(supabase, 'ordens_servico')[1]
    expect(apagar.delete).toHaveBeenCalled()
    expect(apagar.eq).toHaveBeenCalledWith('id', 'OS1')
  })

  it('falha no checklist: OS é apagada e o erro do banco vira mensagem genérica', async () => {
    const supabase = clienteFalso({
      ordens_servico: [osCriada],
      os_checklist: [{ error: { message: 'violates constraint x', code: '23505' } }],
    })
    const r = await abrirOSCom(deps({ supabase }), nova)
    expect(r).toEqual({ ok: false, erro: FALHA_SALVAR })
    expect(cadeias(supabase, 'ordens_servico')[1].delete).toHaveBeenCalled()
  })

  it('erro do banco ao criar a OS vira mensagem genérica e nada mais é gravado', async () => {
    const supabase = clienteFalso({ ordens_servico: [{ data: null, error: { message: 'duplicate key', code: '23505' } }] })
    const r = await abrirOSCom(deps({ supabase }), { ...nova, senhaAparelho: '1234' })
    expect(r).toEqual({ ok: false, erro: FALHA_SALVAR })
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })
})

describe('mudarStatus', () => {
  const lerStatus = (status: string): Resposta => ({ data: { status }, error: null })

  it('transição inválida é recusada com a mensagem de podeMudar, sem chamar o banco para gravar', async () => {
    const supabase = clienteFalso({ ordens_servico: [lerStatus('aberta')] })
    const r = await mudarStatusCom(deps({ supabase }), 'OS1', 'pronto')
    expect(r).toEqual({ ok: false, erro: 'Essa mudança de etapa não é permitida' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('OS encerrada não muda mais, nem para o dono', async () => {
    const supabase = clienteFalso({ ordens_servico: [lerStatus('entregue')] })
    const r = await mudarStatusCom(deps({ supabase }), 'OS1', 'pronto')
    expect(r).toEqual({ ok: false, erro: 'A OS já foi encerrada' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('técnico tentando voltar etapa é recusado', async () => {
    const supabase = clienteFalso({ ordens_servico: [lerStatus('em_servico')] })
    const r = await mudarStatusCom(deps({ supabase, perfil: 'tecnico' }), 'OS1', 'aprovado')
    expect(r).toEqual({ ok: false, erro: 'Só o Dono pode voltar uma etapa' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('o dono pode voltar etapa', async () => {
    const supabase = clienteFalso({ ordens_servico: [lerStatus('em_servico')] })
    const r = await mudarStatusCom(deps({ supabase, perfil: 'dono' }), 'OS1', 'aprovado')
    expect(r).toEqual({ ok: true })
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
  })

  it('status desconhecido é recusado antes de qualquer consulta', async () => {
    const supabase = clienteFalso()
    const d = deps({ supabase })
    const r = await mudarStatusCom(d, 'OS1', 'inventado' as never)
    expect(r.ok).toBe(false)
    expect(d.membroDaSessao).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('sem membro ativo: Acesso negado', async () => {
    const supabase = clienteFalso()
    const r = await mudarStatusCom(deps({ supabase, membro: false }), 'OS1', 'em_analise')
    expect(r).toEqual({ ok: false, erro: 'Acesso negado' })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('OS de outra loja ou inexistente: não encontrada, e nada é gravado', async () => {
    const supabase = clienteFalso({ ordens_servico: [{ data: null, error: null }] })
    const r = await mudarStatusCom(deps({ supabase }), 'OS1', 'em_analise')
    expect(r).toEqual({ ok: false, erro: 'OS não encontrada' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('transição válida: leitura limitada à loja da sessão e uma única chamada que grava status e histórico', async () => {
    const supabase = clienteFalso({ ordens_servico: [lerStatus('aberta')] })
    const r = await mudarStatusCom(deps({ supabase }), 'OS1', 'em_analise', '  chegou  ')
    expect(r).toEqual({ ok: true })
    const [leitura] = cadeias(supabase, 'ordens_servico')
    expect(leitura.eq).toHaveBeenCalledWith('loja_id', 'L1')
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    expect(supabase.rpc).toHaveBeenCalledWith('mudar_status_os', { os: 'OS1', para: 'em_analise', observacao: 'chegou' })
    // status e histórico NÃO são gravados por chamadas soltas: só pela função transacional
    expect(cadeias(supabase, 'os_historico')).toHaveLength(0)
    expect(leitura.update).not.toHaveBeenCalled()
  })

  it('observação em branco vai como nula', async () => {
    const supabase = clienteFalso({ ordens_servico: [lerStatus('aberta')] })
    await mudarStatusCom(deps({ supabase }), 'OS1', 'em_analise', '   ')
    expect(supabase.rpc).toHaveBeenCalledWith('mudar_status_os', { os: 'OS1', para: 'em_analise', observacao: null })
  })

  it('falha do banco: erro genérico, sem vazar a mensagem crua', async () => {
    const supabase = clienteFalso(
      { ordens_servico: [lerStatus('aberta')] },
      { mudar_status_os: [{ error: { message: 'deadlock detected on relation x', code: '40P01' } }] },
    )
    const r = await mudarStatusCom(deps({ supabase }), 'OS1', 'em_analise')
    expect(r).toEqual({ ok: false, erro: FALHA_SALVAR })
  })

  it('mensagem P0001 em português do banco chega à tela', async () => {
    const supabase = clienteFalso(
      { ordens_servico: [lerStatus('aberta')] },
      { mudar_status_os: [{ error: { message: 'OS não encontrada', code: 'P0001' } }] },
    )
    const r = await mudarStatusCom(deps({ supabase }), 'OS1', 'em_analise')
    expect(r).toEqual({ ok: false, erro: 'OS não encontrada' })
  })
})

describe('salvarLaudo', () => {
  it('laudo em branco para antes de tocar o banco', async () => {
    const supabase = clienteFalso()
    const d = deps({ supabase })
    expect(await salvarLaudoCom(d, 'OS1', '   ')).toEqual({ ok: false, erro: 'Escreva o laudo' })
    expect(d.membroDaSessao).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('sem membro ativo: Acesso negado', async () => {
    const supabase = clienteFalso()
    expect(await salvarLaudoCom(deps({ supabase, membro: false }), 'OS1', 'Placa queimada')).toEqual({
      ok: false,
      erro: 'Acesso negado',
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('grava o laudo aparado, limitado à loja da sessão', async () => {
    const supabase = clienteFalso({ ordens_servico: [{ data: { id: 'OS1' }, error: null }] })
    const r = await salvarLaudoCom(deps({ supabase }), 'OS1', '  Placa queimada  ')
    expect(r).toEqual({ ok: true })
    const [c] = cadeias(supabase, 'ordens_servico')
    expect(c.update).toHaveBeenCalledWith({ laudo: 'Placa queimada' })
    expect(c.eq).toHaveBeenCalledWith('id', 'OS1')
    expect(c.eq).toHaveBeenCalledWith('loja_id', 'L1')
  })

  it('OS de outra loja: não encontrada', async () => {
    const supabase = clienteFalso({ ordens_servico: [{ data: null, error: null }] })
    expect(await salvarLaudoCom(deps({ supabase }), 'OS1', 'x')).toEqual({ ok: false, erro: 'OS não encontrada' })
  })

  it('erro do banco vira mensagem genérica', async () => {
    const supabase = clienteFalso({ ordens_servico: [{ data: null, error: { message: 'boom', code: 'XX000' } }] })
    expect(await salvarLaudoCom(deps({ supabase }), 'OS1', 'x')).toEqual({ ok: false, erro: FALHA_SALVAR })
  })
})

describe('leitura', () => {
  const linhaOS = (status: string) => ({
    data: {
      id: 'OS1', numero: 7, interna: true, cliente_id: null, aparelho_tipo: 'celular', marca: null, modelo: null,
      cor: null, imei: null, defeito_relatado: 'x', acessorios: null, observacao: null, tecnico_id: null,
      laudo: null, previsao_entrega: null, status, encerrada_em: null, criado_em: '2026-11-25',
    },
    error: null,
  })

  it('a lista filtra por status e nunca pede a senha', async () => {
    const supabase = clienteFalso({ ordens_servico: [{ data: [], error: null }] })
    await listarOSCom({ supabase: supabase as unknown as SupabaseClient }, 'pronto')
    const [c] = cadeias(supabase, 'ordens_servico')
    expect(c.eq).toHaveBeenCalledWith('status', 'pronto')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('a OS aberta busca a senha pela função, sem checar perfil no app', async () => {
    const supabase = clienteFalso({ ordens_servico: [linhaOS('em_servico')] }, { senha_aparelho: [{ data: '1234', error: null }] })
    const os = await carregarOSCom({ supabase: supabase as unknown as SupabaseClient }, 'OS1')
    expect(supabase.rpc).toHaveBeenCalledWith('senha_aparelho', { os: 'OS1' })
    expect(os?.senhaAparelho).toBe('1234')
  })

  it('OS encerrada não busca a senha', async () => {
    const supabase = clienteFalso({ ordens_servico: [linhaOS('entregue')] })
    const os = await carregarOSCom({ supabase: supabase as unknown as SupabaseClient }, 'OS1')
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(os?.senhaAparelho).toBeNull()
  })

  it('OS que não aparece (outra loja) devolve null sem buscar a senha', async () => {
    const supabase = clienteFalso({ ordens_servico: [{ data: null, error: null }] })
    expect(await carregarOSCom({ supabase: supabase as unknown as SupabaseClient }, 'OS1')).toBeNull()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
