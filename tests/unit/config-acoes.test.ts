import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  FALHA_SALVAR,
  adicionarUsuarioCom,
  atualizarUsuarioCom,
  enviarLogoCom,
  erroDoBanco,
  gerarLinkSenhaCom,
  salvarConfigVendasOSCom,
  salvarServicoCom,
  type Dependencias,
} from '@/lib/configuracoes'

type Resposta = { data?: unknown; error: { message: string; code?: string } | null }

/** Cliente falso: `from(tabela)` devolve uma cadeia que resolve com a próxima resposta da fila da tabela. */
function clienteFalso(respostas: Partial<Record<string, Resposta[]>> = {}, auth: Record<string, unknown> = {}) {
  const cadeia = (tabela: string) => {
    const proxima = () => respostas[tabela]?.shift() ?? { data: null, error: null }
    const c: Record<string, unknown> = {}
    for (const m of ['insert', 'update', 'upsert', 'delete', 'select', 'eq', 'in', 'not', 'order', 'limit']) c[m] = vi.fn(() => c)
    c.single = vi.fn(async () => proxima())
    c.maybeSingle = vi.fn(async () => proxima())
    c.then = (ok: (r: Resposta) => unknown, falha: (e: unknown) => unknown) => Promise.resolve(proxima()).then(ok, falha)
    return c
  }
  return {
    from: vi.fn(cadeia),
    rpc: vi.fn(async () => ({ data: null, error: null })),
    storage: { from: vi.fn(() => ({ upload: vi.fn(async () => ({ error: null })), remove: vi.fn(async () => ({ error: null })) })) },
    auth: {
      admin: {
        createUser: vi.fn(async () => ({ data: { user: { id: 'U9' } }, error: null })),
        generateLink: vi.fn(async () => ({ data: { properties: { hashed_token: 'tok' } }, error: null })),
        getUserById: vi.fn(async () => ({ data: { user: { email: 'tec@loja.test' } }, error: null })),
        deleteUser: vi.fn(async () => ({ error: null })),
        ...auth,
      },
    },
  }
}

type Cliente = ReturnType<typeof clienteFalso>

function deps({ sessao = clienteFalso(), admin = clienteFalso(), dono = true }: { sessao?: Cliente; admin?: Cliente; dono?: boolean } = {}) {
  const d: Dependencias = {
    donoDaSessao: vi.fn(async () => (dono ? { lojaId: 'L1' } : null)),
    supabase: sessao as unknown as SupabaseClient,
    admin: admin as unknown as SupabaseClient,
    origem: vi.fn(async () => 'http://localhost:3000'),
  }
  return d
}

function formUsuario(campos: Partial<Record<'nome' | 'email' | 'perfil' | 'comissao', string>> = {}) {
  const f = new FormData()
  const v = { nome: 'Téo', email: 'Tec@Loja.test', perfil: 'tecnico', comissao: '30', ...campos }
  for (const [k, valor] of Object.entries(v)) f.set(k, valor)
  return f
}

describe('erroDoBanco', () => {
  it('P0001 devolve a mensagem do banco', () => {
    expect(erroDoBanco({ code: 'P0001', message: 'A loja precisa de pelo menos um dono ativo' })).toEqual({
      ok: false,
      erro: 'A loja precisa de pelo menos um dono ativo',
    })
  })
  it('qualquer outro erro vira a mensagem genérica', () => {
    expect(erroDoBanco({ code: '23505', message: 'duplicate key value' })).toEqual({ ok: false, erro: FALHA_SALVAR })
    expect(FALHA_SALVAR).toBe('Não foi possível salvar. Tente de novo.')
  })
})

describe('adicionarUsuario', () => {
  it('limite do plano (P0001): devolve a mensagem do banco e apaga o usuário criado', async () => {
    const admin = clienteFalso({ membros: [{ error: { code: 'P0001', message: 'Limite de usuários do plano atingido' } }] })
    const r = await adicionarUsuarioCom(deps({ admin }), formUsuario())
    expect(r).toEqual({ ok: false, erro: 'Limite de usuários do plano atingido' })
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('U9')
  })

  it('erro desconhecido do banco: mensagem genérica', async () => {
    const admin = clienteFalso({ membros: [{ error: { code: 'XX000', message: 'falhou' } }] })
    const r = await adicionarUsuarioCom(deps({ admin }), formUsuario())
    expect(r).toEqual({ ok: false, erro: 'Não foi possível salvar. Tente de novo.' })
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('U9')
  })

  it('sucesso: cria confirmado, grava membro na loja de quem chamou e a comissão, devolve o link', async () => {
    const admin = clienteFalso({ membros: [{ data: { id: 'M9' }, error: null }] })
    const r = await adicionarUsuarioCom(deps({ admin }), formUsuario())
    expect(r).toEqual({ ok: true, linkDefinirSenha: 'http://localhost:3000/definir-senha?token_hash=tok&type=recovery' })
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'tec@loja.test', email_confirm: true }))
    const insertMembro = admin.from.mock.results[0].value.insert
    expect(insertMembro).toHaveBeenCalledWith({ loja_id: 'L1', user_id: 'U9', nome: 'Téo', perfil: 'tecnico' })
    const insertComissao = admin.from.mock.results[1].value.insert
    expect(insertComissao).toHaveBeenCalledWith({ membro_id: 'M9', loja_id: 'L1', percentual: 30 })
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it('e-mail já cadastrado: explica em português e não grava nada', async () => {
    const admin = clienteFalso({}, { createUser: vi.fn(async () => ({ data: { user: null }, error: { message: 'x', code: 'email_exists' } })) })
    const r = await adicionarUsuarioCom(deps({ admin }), formUsuario())
    expect(r).toEqual({ ok: false, erro: 'Já existe um usuário com este e-mail' })
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('comissão para atendente: erro de validação sem chamar o banco', async () => {
    const admin = clienteFalso()
    const d = deps({ admin })
    const r = await adicionarUsuarioCom(d, formUsuario({ perfil: 'atendente', comissao: '10' }))
    expect(r).toEqual({ ok: false, erro: 'Comissão não vale para atendente' })
    expect(d.donoDaSessao).not.toHaveBeenCalled()
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it('quem não é Dono ativo é recusado antes de qualquer escrita', async () => {
    const admin = clienteFalso()
    const sessao = clienteFalso()
    const r = await adicionarUsuarioCom(deps({ admin, sessao, dono: false }), formUsuario())
    expect(r).toEqual({ ok: false, erro: 'Acesso negado' })
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
    expect(admin.from).not.toHaveBeenCalled()
    expect(sessao.from).not.toHaveBeenCalled()
  })
})

describe('salvarServico', () => {
  it('preço negativo: erro de validação sem chamar o banco', async () => {
    const sessao = clienteFalso()
    const d = deps({ sessao })
    const r = await salvarServicoCom(d, { nome: 'Troca de tela', preco: -1, custo: 100 })
    expect(r).toEqual({ ok: false, erro: 'Não pode ser negativo' })
    expect(d.donoDaSessao).not.toHaveBeenCalled()
    expect(sessao.from).not.toHaveBeenCalled()
  })

  it('não Dono: Acesso negado e nada é gravado', async () => {
    const sessao = clienteFalso()
    const r = await salvarServicoCom(deps({ sessao, dono: false }), { nome: 'Troca de tela', preco: 650, custo: 380 })
    expect(r).toEqual({ ok: false, erro: 'Acesso negado' })
    expect(sessao.from).not.toHaveBeenCalled()
  })

  it('novo serviço: grava preço em servicos e custo em servicos_custo', async () => {
    const sessao = clienteFalso({ servicos: [{ data: { id: 'S1' }, error: null }] })
    const r = await salvarServicoCom(deps({ sessao }), { nome: 'Troca de tela', preco: 650, custo: 380, garantiaDias: 90 })
    expect(r).toEqual({ ok: true })
    expect(sessao.from.mock.results[0].value.insert).toHaveBeenCalledWith({
      loja_id: 'L1', nome: 'Troca de tela', preco: 650, garantia_dias: 90,
    })
    expect(sessao.from.mock.results[1].value.upsert).toHaveBeenCalledWith({ servico_id: 'S1', loja_id: 'L1', custo_peca_estimado: 380 })
  })
})

describe('atualizarUsuario', () => {
  it('último dono (P0001): devolve a mensagem do banco', async () => {
    const sessao = clienteFalso({ membros: [{ error: { code: 'P0001', message: 'A loja precisa de pelo menos um dono ativo' } }] })
    const r = await atualizarUsuarioCom(deps({ sessao }), 'M1', { perfil: 'dono', ativo: false, comissao: null })
    expect(r).toEqual({ ok: false, erro: 'A loja precisa de pelo menos um dono ativo' })
  })

  it('não Dono: Acesso negado', async () => {
    const sessao = clienteFalso()
    const r = await atualizarUsuarioCom(deps({ sessao, dono: false }), 'M1', { perfil: 'tecnico', ativo: true, comissao: 30 })
    expect(r).toEqual({ ok: false, erro: 'Acesso negado' })
    expect(sessao.from).not.toHaveBeenCalled()
  })
})

describe('gerarLinkSenha', () => {
  it('membro de outra loja: não encontrado e nenhum link é gerado', async () => {
    const admin = clienteFalso({ membros: [{ data: null, error: null }] })
    const r = await gerarLinkSenhaCom(deps({ admin }), 'M-outra-loja')
    expect(r).toEqual({ ok: false, erro: 'Usuário não encontrado' })
    const filtro = admin.from.mock.results[0].value.eq
    expect(filtro).toHaveBeenCalledWith('loja_id', 'L1')
    expect(admin.auth.admin.generateLink).not.toHaveBeenCalled()
  })
})

describe('enviarLogo', () => {
  it('arquivo acima de 1 MB: recusado sem chamar o banco', async () => {
    const sessao = clienteFalso()
    const d = deps({ sessao })
    const f = new FormData()
    f.set('logo', new File([new Uint8Array(1024 * 1024 + 1)], 'logo.png', { type: 'image/png' }))
    const r = await enviarLogoCom(d, f)
    expect(r).toEqual({ ok: false, erro: 'A logo pode ter no máximo 1 MB' })
    expect(d.donoDaSessao).not.toHaveBeenCalled()
    expect(sessao.storage.from).not.toHaveBeenCalled()
  })

  it('formato não aceito: recusado', async () => {
    const f = new FormData()
    f.set('logo', new File([new Uint8Array(10)], 'logo.gif', { type: 'image/gif' }))
    expect(await enviarLogoCom(deps(), f)).toEqual({ ok: false, erro: 'Use uma imagem PNG, JPG ou WebP' })
  })
})

describe('salvarConfigVendasOS', () => {
  it('sem nenhuma forma de pagamento: erro de validação', async () => {
    const sessao = clienteFalso()
    const r = await salvarConfigVendasOSCom(deps({ sessao }), {
      orcamentoAlertaDias: 3,
      taxaAvaliacaoAtiva: false,
      taxaAvaliacaoValor: 0,
      osNumeroInicial: 1,
      vendaNumeroInicial: 1,
      formasPagamento: [],
      donoGeraComissao: false,
      tecnicoVePropriaComissao: false,
    })
    expect(r).toEqual({ ok: false, erro: 'Escolha pelo menos uma forma de pagamento' })
    expect(sessao.from).not.toHaveBeenCalled()
  })
})
