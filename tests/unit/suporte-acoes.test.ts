import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  HORAS_SUPORTE,
  encerrarSuporteCom,
  liberarSuporteCom,
  type Dependencias,
} from '@/lib/configuracoes'

type Resposta = { data?: unknown; error: { message: string; code?: string } | null }

/** Cliente falso que registra os insert/update/eq/gt chamados e resolve com a fila da tabela. */
function clienteFalso(respostas: Partial<Record<string, Resposta[]>> = {}) {
  const chamadas = { insert: [] as unknown[], update: [] as unknown[], eq: [] as unknown[][], gt: [] as unknown[][] }
  const cadeia = (tabela: string) => {
    const proxima = () => respostas[tabela]?.shift() ?? { data: null, error: null }
    const c: Record<string, unknown> = {}
    c.insert = vi.fn((v: unknown) => { chamadas.insert.push(v); return c })
    c.update = vi.fn((v: unknown) => { chamadas.update.push(v); return c })
    c.eq = vi.fn((k: string, v: unknown) => { chamadas.eq.push([k, v]); return c })
    c.gt = vi.fn((k: string, v: unknown) => { chamadas.gt.push([k, v]); return c })
    for (const m of ['select', 'order', 'limit']) c[m] = vi.fn(() => c)
    c.maybeSingle = vi.fn(async () => proxima())
    c.then = (ok: (r: Resposta) => unknown, falha: (e: unknown) => unknown) =>
      Promise.resolve(proxima()).then(ok, falha)
    return c
  }
  return { client: { from: vi.fn(cadeia) }, chamadas }
}

function deps({ respostas = {}, dono = true }: { respostas?: Partial<Record<string, Resposta[]>>; dono?: boolean } = {}) {
  const falso = clienteFalso(respostas)
  const d: Dependencias = {
    donoDaSessao: vi.fn(async () => (dono ? { lojaId: 'L1' } : null)),
    supabase: falso.client as unknown as SupabaseClient,
    admin: {} as SupabaseClient,
    origem: vi.fn(async () => 'http://localhost:3000'),
  }
  return { d, chamadas: falso.chamadas, from: falso.client.from }
}

describe('HORAS_SUPORTE', () => {
  it('oferece 24h e 72h', () => {
    expect(HORAS_SUPORTE).toEqual([24, 72])
  })
})

describe('liberarSuporte', () => {
  it('duração fora da lista: erro, sem conferir Dono nem tocar no banco', async () => {
    const { d, from } = deps()
    const r = await liberarSuporteCom(d, 5)
    expect(r).toEqual({ ok: false, erro: 'Duração de suporte inválida' })
    expect(d.donoDaSessao).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })

  it('quem não é Dono ativo: acesso negado', async () => {
    const { d, from } = deps({ dono: false })
    const r = await liberarSuporteCom(d, 24)
    expect(r).toEqual({ ok: false, erro: 'Acesso negado' })
    expect(from).not.toHaveBeenCalled()
  })

  it('Dono libera 24h: grava na loja da sessão com expira_em ~ agora + 24h', async () => {
    const { d, chamadas, from } = deps()
    const r = await liberarSuporteCom(d, 24)
    expect(r).toEqual({ ok: true })
    expect(from).toHaveBeenCalledWith('acessos_suporte')
    const payload = chamadas.insert[0] as { loja_id: string; expira_em: string }
    expect(payload.loja_id).toBe('L1')
    const delta = new Date(payload.expira_em).getTime() - Date.now()
    expect(delta).toBeGreaterThan(23.5 * 3600_000)
    expect(delta).toBeLessThan(24.5 * 3600_000)
  })

  it('Dono libera 72h: expira_em ~ agora + 72h', async () => {
    const { d, chamadas } = deps()
    await liberarSuporteCom(d, 72)
    const payload = chamadas.insert[0] as { expira_em: string }
    const delta = new Date(payload.expira_em).getTime() - Date.now()
    expect(delta).toBeGreaterThan(71.5 * 3600_000)
    expect(delta).toBeLessThan(72.5 * 3600_000)
  })

  it('erro do banco: mensagem genérica', async () => {
    const { d } = deps({ respostas: { acessos_suporte: [{ error: { code: '23505', message: 'x' } }] } })
    const r = await liberarSuporteCom(d, 24)
    expect(r).toEqual({ ok: false, erro: 'Não foi possível salvar. Tente de novo.' })
  })
})

describe('encerrarSuporte', () => {
  it('quem não é Dono ativo: acesso negado', async () => {
    const { d, from } = deps({ dono: false })
    const r = await encerrarSuporteCom(d)
    expect(r).toEqual({ ok: false, erro: 'Acesso negado' })
    expect(from).not.toHaveBeenCalled()
  })

  it('Dono encerra: expira os acessos vigentes da sua loja agora', async () => {
    const { d, chamadas } = deps()
    const r = await encerrarSuporteCom(d)
    expect(r).toEqual({ ok: true })
    const payload = chamadas.update[0] as { expira_em: string }
    expect(typeof payload.expira_em).toBe('string')
    expect(chamadas.eq).toContainEqual(['loja_id', 'L1'])
    expect(chamadas.gt[0][0]).toBe('expira_em')
  })
})
