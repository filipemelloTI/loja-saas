import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { atualizarLojaCom, criarLojaCom, salvarPlanoCom, type Dependencias } from '@/lib/plataforma'

type Resposta = { data?: unknown; error: { message: string; code?: string } | null }

/** Cliente falso: `from(tabela)` devolve uma cadeia que resolve com a resposta da fila da tabela. */
function clienteFalso(respostas: Partial<Record<string, Resposta[]>> = {}, auth: Record<string, unknown> = {}) {
  const cadeia = (tabela: string) => {
    const proxima = () => respostas[tabela]?.shift() ?? { data: null, error: null }
    const c: Record<string, unknown> = {}
    for (const m of ['insert', 'update', 'select', 'eq', 'order', 'limit']) c[m] = vi.fn(() => c)
    c.single = vi.fn(async () => proxima())
    c.maybeSingle = vi.fn(async () => proxima())
    c.then = (ok: (r: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(proxima()).then(ok, falha)
    return c
  }
  const cliente = {
    from: vi.fn(cadeia),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    auth: { admin: { createUser: vi.fn(), generateLink: vi.fn(), deleteUser: vi.fn(async () => ({ error: null })), ...auth } },
  }
  return cliente
}

function deps(cliente = clienteFalso(), admin = true) {
  const d: Dependencias = {
    souAdmin: vi.fn(async () => admin),
    admin: cliente as unknown as SupabaseClient,
    origem: vi.fn(async () => 'http://localhost:3000'),
  }
  return d
}

function formulario(campos: Partial<{ nomeLoja: string; nomeDono: string; emailDono: string; planoId: string; modulos: string[] }>) {
  const f = new FormData()
  const v = { nomeLoja: 'Loja Teste', nomeDono: 'Ana', emailDono: 'ana@loja.test', planoId: 'p1', modulos: ['servico'], ...campos }
  f.set('nomeLoja', v.nomeLoja)
  f.set('nomeDono', v.nomeDono)
  f.set('emailDono', v.emailDono)
  f.set('planoId', v.planoId)
  v.modulos.forEach((m) => f.append('modulos', m))
  return f
}

describe('criarLoja', () => {
  it('Vendas sem Estoque: erro em português, sem chamar o Supabase', async () => {
    const cliente = clienteFalso()
    const d = deps(cliente)
    const r = await criarLojaCom(d, formulario({ modulos: ['vendas'] }))
    expect(r).toEqual({ ok: false, erro: 'Vendas exige o módulo Estoque' })
    expect(d.souAdmin).not.toHaveBeenCalled()
    expect(cliente.from).not.toHaveBeenCalled()
    expect(cliente.rpc).not.toHaveBeenCalled()
  })

  it('e-mail inválido: erro em português, sem chamar o Supabase', async () => {
    const cliente = clienteFalso()
    const d = deps(cliente)
    const r = await criarLojaCom(d, formulario({ emailDono: 'nao-e-email' }))
    expect(r).toEqual({ ok: false, erro: 'E-mail inválido' })
    expect(d.souAdmin).not.toHaveBeenCalled()
    expect(cliente.from).not.toHaveBeenCalled()
  })

  it('quem não é admin da plataforma recebe Acesso negado e nada é gravado', async () => {
    const cliente = clienteFalso()
    const r = await criarLojaCom(deps(cliente, false), formulario({}))
    expect(r).toEqual({ ok: false, erro: 'Acesso negado' })
    expect(cliente.from).not.toHaveBeenCalled()
  })

  it('sucesso: devolve o link de definir senha montado com o hashed_token', async () => {
    const cliente = clienteFalso(
      { lojas: [{ data: { id: 'L1' }, error: null }], membros: [{ error: null }] },
      {
        createUser: vi.fn(async () => ({ data: { user: { id: 'U1' } }, error: null })),
        generateLink: vi.fn(async () => ({ data: { properties: { hashed_token: 'tok' } }, error: null })),
      },
    )
    const r = await criarLojaCom(deps(cliente), formulario({}))
    expect(r).toEqual({ ok: true, linkDefinirSenha: 'http://localhost:3000/definir-senha?token_hash=tok&type=recovery' })
    expect(cliente.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@loja.test', email_confirm: true }),
    )
    expect(cliente.auth.admin.generateLink).toHaveBeenCalledWith({ type: 'recovery', email: 'ana@loja.test' })
  })

  it('e-mail já cadastrado: desfaz a loja e explica em português', async () => {
    const cliente = clienteFalso(
      { lojas: [{ data: { id: 'L1' }, error: null }] },
      { createUser: vi.fn(async () => ({ data: { user: null }, error: { message: 'exists', code: 'email_exists' } })) },
    )
    const r = await criarLojaCom(deps(cliente), formulario({}))
    expect(r).toEqual({ ok: false, erro: 'Já existe um usuário com este e-mail' })
    expect(cliente.rpc).toHaveBeenCalledWith('desfazer_loja_nova', { p_loja: 'L1' })
    expect(cliente.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it('falha ao gravar o Dono: apaga o usuário e a loja criados', async () => {
    const cliente = clienteFalso(
      { lojas: [{ data: { id: 'L1' }, error: null }], membros: [{ error: { message: 'falhou', code: 'XX000' } }] },
      {
        createUser: vi.fn(async () => ({ data: { user: { id: 'U1' } }, error: null })),
        generateLink: vi.fn(async () => ({ data: { properties: { hashed_token: 'tok' } }, error: null })),
      },
    )
    const r = await criarLojaCom(deps(cliente), formulario({}))
    expect(r).toEqual({ ok: false, erro: 'Não foi possível criar a loja. Nada foi gravado; tente de novo.' })
    expect(cliente.auth.admin.deleteUser).toHaveBeenCalledWith('U1')
    expect(cliente.rpc).toHaveBeenCalledWith('desfazer_loja_nova', { p_loja: 'L1' })
  })

  const ROLLBACK_INCOMPLETO =
    'A criação falhou e não foi possível desfazer tudo. Anote o e-mail e verifique no painel do Supabase.'

  function clienteMembroFalha(auth: Record<string, unknown> = {}) {
    return clienteFalso(
      { lojas: [{ data: { id: 'L1' }, error: null }], membros: [{ error: { message: 'falhou', code: 'XX000' } }] },
      {
        createUser: vi.fn(async () => ({ data: { user: { id: 'U1' } }, error: null })),
        generateLink: vi.fn(async () => ({ data: { properties: { hashed_token: 'tok' } }, error: null })),
        ...auth,
      },
    )
  }

  it('falha ao gravar o Dono e não consegue apagar o usuário: avisa que não desfez tudo e registra os ids', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cliente = clienteMembroFalha({ deleteUser: vi.fn(async () => ({ error: { message: 'gotrue fora' } })) })
    const r = await criarLojaCom(deps(cliente), formulario({}))
    expect(r).toEqual({ ok: false, erro: ROLLBACK_INCOMPLETO })
    expect(cliente.rpc).toHaveBeenCalledWith('desfazer_loja_nova', { p_loja: 'L1' })
    expect(log).toHaveBeenCalledWith('criarLoja: rollback incompleto', { lojaId: 'L1', userId: 'U1', falhou: ['apagar usuário'] })
    log.mockRestore()
  })

  it('falha ao gravar o Dono e não consegue apagar a loja: avisa que não desfez tudo', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cliente = clienteMembroFalha()
    cliente.rpc.mockResolvedValueOnce({ data: null, error: { message: 'falhou' } } as never)
    const r = await criarLojaCom(deps(cliente), formulario({}))
    expect(r).toEqual({ ok: false, erro: ROLLBACK_INCOMPLETO })
    expect(log).toHaveBeenCalledWith('criarLoja: rollback incompleto', { lojaId: 'L1', userId: 'U1', falhou: ['apagar loja'] })
    log.mockRestore()
  })
})

describe('atualizarLoja', () => {
  it('Vendas sem Estoque: erro antes de qualquer chamada', async () => {
    const cliente = clienteFalso()
    const d = deps(cliente)
    const r = await atualizarLojaCom(d, 'L1', { planoId: 'p1', modulos: ['vendas'], situacao: 'em_dia' })
    expect(r).toEqual({ ok: false, erro: 'Vendas exige o módulo Estoque' })
    expect(d.souAdmin).not.toHaveBeenCalled()
    expect(cliente.from).not.toHaveBeenCalled()
  })

  it('situação desconhecida é recusada', async () => {
    const r = await atualizarLojaCom(deps(), 'L1', { planoId: 'p1', modulos: [], situacao: 'bloqueada' as never })
    expect(r).toEqual({ ok: false, erro: 'Situação inválida' })
  })

  it('não admin: Acesso negado', async () => {
    const cliente = clienteFalso()
    const r = await atualizarLojaCom(deps(cliente, false), 'L1', { planoId: 'p1', modulos: ['servico'], situacao: 'suspensa' })
    expect(r).toEqual({ ok: false, erro: 'Acesso negado' })
    expect(cliente.from).not.toHaveBeenCalled()
  })
})

describe('salvarPlano', () => {
  it('limite de usuários precisa ser pelo menos 1', async () => {
    const cliente = clienteFalso()
    const r = await salvarPlanoCom(deps(cliente), { nome: 'Básico', modulos: ['servico'], limiteUsuarios: 0 })
    expect(r).toEqual({ ok: false, erro: 'Deve ser no mínimo 1' })
    expect(cliente.from).not.toHaveBeenCalled()
  })

  it('nome repetido vira mensagem em português', async () => {
    const cliente = clienteFalso({ planos: [{ error: { message: 'duplicate key', code: '23505' } }] })
    const r = await salvarPlanoCom(deps(cliente), { nome: 'Completo', modulos: ['servico'], limiteUsuarios: 3 })
    expect(r).toEqual({ ok: false, erro: 'Já existe um plano com este nome' })
  })
})
