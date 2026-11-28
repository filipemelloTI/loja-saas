import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { abrirGarantiaCom, ajustarGarantiaCom, SO_DONO_GARANTIA } from '@/lib/garantia-acoes'
import { dataNaLoja, situacaoGarantia, somarDias } from '@/lib/garantia'
import type { Dependencias } from '@/lib/os'
import type { Perfil } from '@/lib/tipos'

describe('contas de garantia', () => {
  it('data da entrega é a de Brasília (23h de Brasília já é outro dia em UTC)', () => {
    expect(dataNaLoja('2026-11-29T02:30:00Z')).toBe('2026-11-28')
  })

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-11-28', 90)).toBe('2027-02-26')
  })

  it('vigente, vencendo (15 dias ou menos), vencida — o dia do vencimento ainda vale', () => {
    const entrega = '2026-11-28T15:00:00Z'
    expect(situacaoGarantia(entrega, 90, new Date('2026-12-01T15:00:00Z'))).toEqual({
      venceEm: '2027-02-26',
      diasRestantes: 87,
      situacao: 'vigente',
    })
    expect(situacaoGarantia(entrega, 90, new Date('2027-02-11T15:00:00Z')).situacao).toBe('vencendo')
    expect(situacaoGarantia(entrega, 90, new Date('2027-02-26T15:00:00Z'))).toMatchObject({ diasRestantes: 0, situacao: 'vencendo' })
    expect(situacaoGarantia(entrega, 90, new Date('2027-02-27T15:00:00Z')).situacao).toBe('vencida')
  })
})

function deps(perfil: Perfil, resposta: { data?: unknown; error: unknown } = { data: [{ id: 'OS1' }], error: null }) {
  const c: Record<string, unknown> = {}
  for (const m of ['update', 'eq', 'select']) c[m] = vi.fn(() => c)
  c.then = (ok: (r: unknown) => unknown) => Promise.resolve(resposta).then(ok)
  const supabase = { from: vi.fn(() => c), rpc: vi.fn(async () => resposta) }
  const d: Dependencias = {
    membroDaSessao: vi.fn(async () => ({ lojaId: 'L1', perfil })),
    supabase: supabase as unknown as SupabaseClient,
  }
  return { d, supabase, cadeia: c }
}

describe('ações de garantia', () => {
  it('só o Dono ajusta o prazo', async () => {
    const { d, supabase } = deps('atendente')
    expect(await ajustarGarantiaCom(d, 'OS1', 30)).toEqual({ ok: false, erro: SO_DONO_GARANTIA })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('prazo inválido não chega ao banco', async () => {
    const { d, supabase } = deps('dono')
    expect((await ajustarGarantiaCom(d, 'OS1', -1)).ok).toBe(false)
    expect((await ajustarGarantiaCom(d, 'OS1', 1.5)).ok).toBe(false)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('Dono grava o ajuste na loja da sessão; null volta ao automático', async () => {
    const { d, cadeia } = deps('dono')
    expect(await ajustarGarantiaCom(d, 'OS1', null)).toEqual({ ok: true })
    expect(cadeia.update).toHaveBeenCalledWith({ garantia_ajuste_dias: null })
    expect(cadeia.eq).toHaveBeenCalledWith('loja_id', 'L1')
  })

  it('abrir garantia exige descrever o problema', async () => {
    const { d, supabase } = deps('atendente')
    expect(await abrirGarantiaCom(d, 'OS1', '  ')).toEqual({ ok: false, erro: 'Descreva o problema que voltou.' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('abrir garantia devolve a OS nova; a recusa do banco chega em português', async () => {
    const ok = deps('atendente', { data: 'OS2', error: null })
    expect(await abrirGarantiaCom(ok.d, 'OS1', 'Voltou a piscar')).toEqual({ ok: true, id: 'OS2' })
    expect(ok.supabase.rpc).toHaveBeenCalledWith('abrir_os_garantia', { os: 'OS1', defeito: 'Voltou a piscar' })

    const venceu = deps('atendente', { error: { message: 'A garantia desta OS venceu em 26/02/2027.', code: 'P0001' } })
    expect(await abrirGarantiaCom(venceu.d, 'OS1', 'x')).toEqual({ ok: false, erro: 'A garantia desta OS venceu em 26/02/2027.' })
  })
})
