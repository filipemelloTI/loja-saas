import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarClientesCom, salvarClienteCom, type Dependencias } from '@/lib/clientes'

type Resposta = { data?: unknown; error: { message: string; code?: string } | null }

/** Cliente falso: `from(tabela)` devolve uma cadeia que resolve com a próxima resposta da fila da tabela. */
function clienteFalso(respostas: Partial<Record<string, Resposta[]>> = {}) {
  const cadeia = (tabela: string) => {
    const proxima = () => respostas[tabela]?.shift() ?? { data: null, error: null }
    const c: Record<string, unknown> = {}
    for (const m of ['insert', 'update', 'select', 'eq', 'or', 'ilike', 'not', 'order', 'limit']) c[m] = vi.fn(() => c)
    c.single = vi.fn(async () => proxima())
    c.maybeSingle = vi.fn(async () => proxima())
    c.then = (ok: (r: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(proxima()).then(ok, falha)
    return c
  }
  return { from: vi.fn(cadeia) }
}

type Falso = ReturnType<typeof clienteFalso>

function deps({ supabase = clienteFalso(), membro = true }: { supabase?: Falso; membro?: boolean } = {}) {
  const d: Dependencias = {
    membroDaSessao: vi.fn(async () => (membro ? { lojaId: 'L1' } : null)),
    supabase: supabase as unknown as SupabaseClient,
  }
  return d
}

const valido = { nome: 'Maria', telefone: '(11) 99999-0000' }
const linha = {
  id: 'C1', nome: 'Maria', telefone: '11999990000', cpf: null, email: null, endereco: null, nascimento: null,
}

describe('salvarCliente', () => {
  it('dados inválidos param antes de tocar o banco', async () => {
    const supabase = clienteFalso()
    const d = deps({ supabase })
    const r = await salvarClienteCom(d, { nome: ' ', telefone: '1' })
    expect(r).toEqual({ ok: false, erro: 'Informe o nome' })
    expect(d.membroDaSessao).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('sem membro ativo na sessão: Acesso negado e nada é gravado', async () => {
    const supabase = clienteFalso()
    const r = await salvarClienteCom(deps({ supabase, membro: false }), valido)
    expect(r).toEqual({ ok: false, erro: 'Acesso negado' })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('cadastro novo: grava na loja da sessão, ignorando loja_id vindo do chamador', async () => {
    const supabase = clienteFalso()
    const r = await salvarClienteCom(deps({ supabase }), { ...valido, loja_id: 'L-OUTRA', lojaId: 'L-OUTRA' } as typeof valido)
    expect(r).toEqual({ ok: true })
    expect(supabase.from).toHaveBeenCalledWith('clientes')
    expect(supabase.from.mock.results[0].value.insert).toHaveBeenCalledWith({
      loja_id: 'L1', nome: 'Maria', telefone: '(11) 99999-0000', cpf: null, email: null, endereco: null, nascimento: null,
    })
  })

  it('edição: atualiza só o cliente pedido dentro da loja da sessão e limpa campo apagado', async () => {
    const supabase = clienteFalso({ clientes: [{ data: { id: 'C1' }, error: null }] })
    const r = await salvarClienteCom(deps({ supabase }), { ...valido, email: '' }, 'C1')
    expect(r).toEqual({ ok: true })
    const c = supabase.from.mock.results[0].value
    expect(c.update).toHaveBeenCalledWith({
      nome: 'Maria', telefone: '(11) 99999-0000', cpf: null, email: null, endereco: null, nascimento: null,
    })
    expect(c.eq).toHaveBeenCalledWith('id', 'C1')
    expect(c.eq).toHaveBeenCalledWith('loja_id', 'L1')
  })

  it('edição de cliente que não existe nesta loja: não encontrado', async () => {
    const supabase = clienteFalso({ clientes: [{ data: null, error: null }] })
    expect(await salvarClienteCom(deps({ supabase }), valido, 'C-outra')).toEqual({ ok: false, erro: 'Cliente não encontrado' })
  })

  it('erro do banco vira a mensagem genérica, nunca o texto cru do Postgres', async () => {
    const supabase = clienteFalso({ clientes: [{ error: { code: '23505', message: 'duplicate key value violates "clientes_pkey"' } }] })
    const r = await salvarClienteCom(deps({ supabase }), valido)
    expect(r).toEqual({ ok: false, erro: 'Não foi possível salvar. Tente de novo.' })
  })

  it('erro P0001 do banco (já em português) passa adiante', async () => {
    const supabase = clienteFalso({ clientes: [{ error: { code: 'P0001', message: 'Cliente de outra loja' } }] })
    expect(await salvarClienteCom(deps({ supabase }), valido)).toEqual({ ok: false, erro: 'Cliente de outra loja' })
  })
})

describe('buscarClientes', () => {
  it('termo vazio: devolve os mais recentes, sem filtrar nem olhar as OS', async () => {
    const supabase = clienteFalso({ clientes: [{ data: [linha], error: null }] })
    const r = await buscarClientesCom(deps({ supabase }), '   ')
    expect(r).toEqual([linha])
    expect(supabase.from).toHaveBeenCalledTimes(1)
    const c = supabase.from.mock.results[0].value
    expect(c.order).toHaveBeenCalledWith('criado_em', { ascending: false })
    expect(c.or).not.toHaveBeenCalled()
  })

  it('escapa % e _ para não virarem curinga: "100%" procura o literal', async () => {
    const supabase = clienteFalso({ clientes: [{ data: [], error: null }] })
    await buscarClientesCom(deps({ supabase }), '100%')
    const filtroOS = supabase.from.mock.results[0].value.ilike
    expect(supabase.from.mock.calls[0][0]).toBe('ordens_servico')
    expect(filtroOS).toHaveBeenCalledWith('imei', '%100\\%%')
    const filtro = supabase.from.mock.results[1].value.or
    expect(filtro).toHaveBeenCalledTimes(1)
    const texto = filtro.mock.calls[0][0] as string
    // `\%` do LIKE, com a barra dobrada para o PostgREST.
    expect(texto).toContain('nome.ilike."%100\\\\%%"')
    expect(texto).toContain('telefone.ilike."%100\\\\%%"')
    expect(texto).toContain('cpf.ilike."%100\\\\%%"')
    expect(texto).not.toContain('%100%')
  })

  it('escapa também o sublinhado', async () => {
    const supabase = clienteFalso({ clientes: [{ data: [], error: null }] })
    await buscarClientesCom(deps({ supabase }), 'a_b')
    expect(supabase.from.mock.results[0].value.ilike).toHaveBeenCalledWith('imei', '%a\\_b%')
  })

  it('vírgula, parêntese e aspas no termo não quebram nem injetam filtro', async () => {
    const supabase = clienteFalso({ clientes: [{ data: [], error: null }] })
    await buscarClientesCom(deps({ supabase }), 'x",id.neq.0)')
    const texto = supabase.from.mock.results[1].value.or.mock.calls[0][0] as string
    expect(texto).toContain('nome.ilike."%x\\",id.neq.0)%"')
  })

  it('procura também pelo IMEI da OS do cliente', async () => {
    const supabase = clienteFalso({
      ordens_servico: [{ data: [{ cliente_id: 'C7' }, { cliente_id: 'C7' }, { cliente_id: 'C8' }], error: null }],
      clientes: [{ data: [linha], error: null }],
    })
    const r = await buscarClientesCom(deps({ supabase }), '3567')
    expect(r).toEqual([linha])
    const texto = supabase.from.mock.results[1].value.or.mock.calls[0][0] as string
    expect(texto).toContain('id.in.(C7,C8)')
  })

  it('sem OS com esse IMEI: o filtro não leva cláusula de id', async () => {
    const supabase = clienteFalso({ ordens_servico: [{ data: [], error: null }], clientes: [{ data: [], error: null }] })
    await buscarClientesCom(deps({ supabase }), 'ana')
    const texto = supabase.from.mock.results[1].value.or.mock.calls[0][0] as string
    expect(texto).not.toContain('id.in')
  })

  it('erro do banco: lista vazia, sem estourar com texto do Postgres', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = clienteFalso({
      ordens_servico: [{ data: [], error: null }],
      clientes: [{ error: { code: 'XX000', message: 'relation "clientes" exploded' } }],
    })
    expect(await buscarClientesCom(deps({ supabase }), '52998224725')).toEqual([])
    expect(JSON.stringify(erro.mock.calls)).not.toContain('52998224725')
    erro.mockRestore()
  })
})
