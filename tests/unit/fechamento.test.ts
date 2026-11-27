import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { carregarFechamentoCom, entregarOSCom } from '@/lib/fechamento'
import type { Dependencias } from '@/lib/os'
import { FALHA_SALVAR } from '@/lib/resultado'

type Resposta = { data?: unknown; error: { message: string; code?: string } | null }

function clienteFalso(linha: Resposta = { data: null, error: null }, rpc: Resposta = { data: null, error: null }) {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'eq']) c[m] = vi.fn(() => c)
  c.maybeSingle = vi.fn(async () => linha)
  return { from: vi.fn(() => c), rpc: vi.fn(async () => rpc) }
}

function deps(supabase = clienteFalso(), membro = true): Dependencias {
  return {
    membroDaSessao: vi.fn(async () => (membro ? { lojaId: 'L1', perfil: 'atendente' as const } : null)),
    supabase: supabase as unknown as SupabaseClient,
  }
}

describe('entregar OS', () => {
  it('chama a função do banco com o id da OS', async () => {
    const supabase = clienteFalso()
    expect(await entregarOSCom(deps(supabase), 'OS1')).toEqual({ ok: true })
    expect(supabase.rpc).toHaveBeenCalledWith('entregar_os', { os: 'OS1' })
  })

  it('a recusa do banco chega como veio (diz o que falta)', async () => {
    const falta = 'Falta receber R$ 350,00 antes de entregar.'
    const supabase = clienteFalso(undefined, { error: { message: falta, code: 'P0001' } })
    expect(await entregarOSCom(deps(supabase), 'OS1')).toEqual({ ok: false, erro: falta })
  })

  it('erro técnico vira mensagem genérica', async () => {
    const supabase = clienteFalso(undefined, { error: { message: 'connection reset', code: '08006' } })
    expect(await entregarOSCom(deps(supabase), 'OS1')).toEqual({ ok: false, erro: FALHA_SALVAR })
  })

  it('sem membro ativo, nada é chamado', async () => {
    const supabase = clienteFalso()
    expect(await entregarOSCom(deps(supabase, false), 'OS1')).toEqual({ ok: false, erro: 'Acesso negado' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

describe('carregar fechamento', () => {
  it('converte os números', async () => {
    const supabase = clienteFalso({
      data: {
        total: '650.00',
        custo_pecas: '280.00',
        comissao_percentual: '30.00',
        comissao: '111.00',
        lucro: '259.00',
        tecnico_id: 'M1',
        fechado_em: '2026-11-26T21:00:00Z',
      },
      error: null,
    })
    expect(await carregarFechamentoCom(supabase as unknown as SupabaseClient, 'OS1')).toEqual({
      total: 650,
      custoPecas: 280,
      comissaoPercentual: 30,
      comissao: 111,
      lucro: 259,
      tecnicoId: 'M1',
      fechadoEm: '2026-11-26T21:00:00Z',
    })
  })

  it('sem linha (não é Dono, ou não entregue): null', async () => {
    expect(await carregarFechamentoCom(clienteFalso() as unknown as SupabaseClient, 'OS1')).toBeNull()
  })
})
