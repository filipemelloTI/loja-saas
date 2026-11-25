import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarClientesCom, salvarClienteCom, type Dependencias } from '@/lib/clientes'

type Resposta = { data?: unknown; error: { message: string; code?: string } | null }

/** Cliente falso: `from(tabela)` devolve uma cadeia que resolve com a próxima resposta da fila da tabela. */
function clienteFalso(respostas: Partial<Record<string, Resposta[]>> = {}) {
  const cadeia = (tabela: string) => {
    const proxima = () => respostas[tabela]?.shift() ?? { data: null, error: null }
    const c: Record<string, unknown> = {}
    for (const m of ['insert', 'update', 'select', 'eq', 'in', 'ilike', 'not', 'order', 'limit']) c[m] = vi.fn(() => c)
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
      loja_id: 'L1', nome: 'Maria', telefone: '11999990000', cpf: null, email: null, endereco: null, nascimento: null,
    })
  })

  it('telefone e CPF vão para o banco só com dígitos', async () => {
    const supabase = clienteFalso()
    const r = await salvarClienteCom(deps({ supabase }), { ...valido, cpf: '529.982.247-25' })
    expect(r).toEqual({ ok: true })
    expect(supabase.from.mock.results[0].value.insert).toHaveBeenCalledWith(
      expect.objectContaining({ telefone: '11999990000', cpf: '52998224725' }),
    )
  })

  it('telefone sem nenhum dígito é recusado antes de gravar', async () => {
    const supabase = clienteFalso()
    const r = await salvarClienteCom(deps({ supabase }), { ...valido, telefone: 'sem telefone' })
    expect(r).toEqual({ ok: false, erro: 'Informe o telefone' })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('edição: atualiza só o cliente pedido dentro da loja da sessão e limpa campo apagado', async () => {
    const supabase = clienteFalso({ clientes: [{ data: { id: 'C1' }, error: null }] })
    const r = await salvarClienteCom(deps({ supabase }), { ...valido, email: '' }, 'C1')
    expect(r).toEqual({ ok: true })
    const c = supabase.from.mock.results[0].value
    expect(c.update).toHaveBeenCalledWith({
      nome: 'Maria', telefone: '11999990000', cpf: null, email: null, endereco: null, nascimento: null,
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
    expect(c.ilike).not.toHaveBeenCalled()
  })

  // O fake só prova o que é entregue ao supabase-js; que o Postgres trate `%` como literal
  // foi conferido à mão contra o banco real (o `.or()` com aspas NÃO respeita o escape, por isso não se usa).
  it('escapa % e _ para não virarem curinga: "100%" vai como 100\% no nome e no IMEI', async () => {
    const supabase = clienteFalso()
    await buscarClientesCom(deps({ supabase }), '100%')
    const ilikes = supabase.from.mock.calls.map((c, i) => [c[0], supabase.from.mock.results[i].value.ilike.mock.calls[0]])
    expect(ilikes).toContainEqual(['clientes', ['nome', '%100\\%%']])
    expect(ilikes).toContainEqual(['ordens_servico', ['imei', '%100\\%%']])
  })

  it('escapa também o sublinhado e a barra', async () => {
    const supabase = clienteFalso()
    await buscarClientesCom(deps({ supabase }), 'a_b\\c')
    expect(supabase.from.mock.results[0].value.ilike).toHaveBeenCalledWith('nome', '%a\\_b\\\\c%')
  })

  it('telefone e CPF são buscados pelos dígitos do termo: com ou sem máscara dá o mesmo padrão', async () => {
    const padroes = async (termo: string) => {
      const supabase = clienteFalso()
      await buscarClientesCom(deps({ supabase }), termo)
      return supabase.from.mock.results
        .map((r, i) => [supabase.from.mock.calls[i][0], r.value.ilike.mock.calls[0]] as const)
        .filter(([, ilike]) => ilike[0] === 'telefone' || ilike[0] === 'cpf')
        .map(([, ilike]) => ilike)
    }
    const mascarado = await padroes('(13) 99999-0001')
    expect(mascarado).toEqual([['telefone', '%13999990001%'], ['cpf', '%13999990001%']])
    expect(await padroes('13999990001')).toEqual(mascarado)
    expect(await padroes('529.982.247-25')).toEqual([['telefone', '%52998224725%'], ['cpf', '%52998224725%']])
  })

  it('termo sem dígitos: nenhuma consulta de telefone ou CPF (não casaria com tudo)', async () => {
    const supabase = clienteFalso()
    await buscarClientesCom(deps({ supabase }), 'ana')
    const colunas = supabase.from.mock.results.flatMap((r) => r.value.ilike.mock.calls.map((c: unknown[]) => c[0]))
    expect(colunas).toEqual(['nome', 'imei'])
  })

  it('o limite de 50 é aplicado com ordem estável: nome nas consultas de cliente, OS mais nova primeiro', async () => {
    const supabase = clienteFalso()
    await buscarClientesCom(deps({ supabase }), 'ana')
    const [clientes, os] = supabase.from.mock.results.map((r) => r.value)
    expect(clientes.order).toHaveBeenCalledWith('nome')
    expect(os.order).toHaveBeenCalledWith('criado_em', { ascending: false })
  })

  it('procura também pelo IMEI da OS do cliente e junta sem repetir, em ordem de nome', async () => {
    const zeca = { ...linha, id: 'C8', nome: 'Zeca' }
    const supabase = clienteFalso({
      clientes: [
        { data: [zeca], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [zeca, linha], error: null },
      ],
      ordens_servico: [{ data: [{ cliente_id: 'C1' }, { cliente_id: 'C1' }, { cliente_id: 'C8' }], error: null }],
    })
    const r = await buscarClientesCom(deps({ supabase }), '3567')
    expect(r).toEqual([linha, zeca])
    expect(supabase.from.mock.results[4].value.in).toHaveBeenCalledWith('id', ['C1', 'C8'])
  })

  it('sem OS com esse IMEI: não faz a consulta por id', async () => {
    const supabase = clienteFalso()
    await buscarClientesCom(deps({ supabase }), '3567')
    expect(supabase.from).toHaveBeenCalledTimes(4)
  })

  it('erro do banco: lista vazia, sem estourar nem logar o termo', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const supabase = clienteFalso({ clientes: [{ error: { code: 'XX000', message: 'relation "clientes" exploded' } }] })
    expect(await buscarClientesCom(deps({ supabase }), '52998224725')).toEqual([])
    expect(JSON.stringify(erro.mock.calls)).not.toContain('52998224725')
    erro.mockRestore()
  })
})
