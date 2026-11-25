import { describe, expect, test } from 'vitest'
import { avancosDe, ehTerminal, podeMudar, ROTULO_STATUS, type StatusOS } from '@/lib/os-status'

const TODOS: StatusOS[] = [
  'aberta',
  'em_analise',
  'orcamento_enviado',
  'aprovado',
  'recusado',
  'aguardando_peca',
  'em_servico',
  'pronto',
  'pronto_devolucao',
  'entregue',
  'devolvido',
]

describe('máquina de status da OS', () => {
  test('avança pelo caminho normal', () => {
    expect(podeMudar('aberta', 'em_analise', 'atendente')).toEqual({ ok: true })
    expect(podeMudar('em_servico', 'pronto', 'tecnico')).toEqual({ ok: true })
  })

  test('atalho do balcão: aberta direto para aprovado', () => {
    expect(podeMudar('aberta', 'aprovado', 'atendente')).toEqual({ ok: true })
  })

  test('pulo inválido é recusado', () => {
    expect(podeMudar('aberta', 'entregue', 'dono').ok).toBe(false)
    expect(podeMudar('aberta', 'entregue', 'dono')).toEqual({
      ok: false,
      erro: 'Essa mudança de etapa não é permitida',
    })
  })

  test('voltar etapa é só do Dono', () => {
    expect(podeMudar('em_servico', 'aprovado', 'dono')).toEqual({ ok: true })
    expect(podeMudar('em_servico', 'aprovado', 'tecnico')).toEqual({
      ok: false,
      erro: 'Só o Dono pode voltar uma etapa',
    })
    expect(podeMudar('em_servico', 'aprovado', 'atendente')).toEqual({
      ok: false,
      erro: 'Só o Dono pode voltar uma etapa',
    })
  })

  test('OS encerrada não volta, nem para o Dono', () => {
    expect(ehTerminal('entregue')).toBe(true)
    expect(podeMudar('entregue', 'pronto', 'dono')).toEqual({
      ok: false,
      erro: 'A OS já foi encerrada',
    })
    expect(podeMudar('devolvido', 'recusado', 'dono')).toEqual({
      ok: false,
      erro: 'A OS já foi encerrada',
    })
  })

  test('ficar na mesma etapa não é mudança', () => {
    expect(podeMudar('em_servico', 'em_servico', 'dono')).toEqual({
      ok: false,
      erro: 'Essa mudança de etapa não é permitida',
    })
  })

  test('o Dono pode voltar várias etapas de uma vez', () => {
    expect(podeMudar('pronto', 'aberta', 'dono')).toEqual({ ok: true })
    expect(podeMudar('pronto', 'aberta', 'tecnico')).toEqual({
      ok: false,
      erro: 'Só o Dono pode voltar uma etapa',
    })
  })

  test('mudança lateral é recusada até para o Dono', () => {
    const recusa = { ok: false, erro: 'Essa mudança de etapa não é permitida' }
    expect(podeMudar('recusado', 'aprovado', 'dono')).toEqual(recusa)
    expect(podeMudar('aguardando_peca', 'recusado', 'dono')).toEqual(recusa)
  })

  test('tabela de avanços, linha por linha', () => {
    const esperado: Record<StatusOS, StatusOS[]> = {
      aberta: ['em_analise', 'aprovado'],
      em_analise: ['orcamento_enviado', 'aprovado'],
      orcamento_enviado: ['aprovado', 'recusado'],
      aprovado: ['aguardando_peca', 'em_servico'],
      aguardando_peca: ['em_servico'],
      em_servico: ['pronto'],
      pronto: ['entregue'],
      recusado: ['pronto_devolucao'],
      pronto_devolucao: ['devolvido'],
      entregue: [],
      devolvido: [],
    }
    for (const s of TODOS) {
      expect(avancosDe(s), s).toEqual(esperado[s])
    }
  })

  test('todos os 11 estados têm rótulo e tom', () => {
    expect(Object.keys(ROTULO_STATUS).sort()).toEqual([...TODOS].sort())
    for (const s of TODOS) {
      expect(ROTULO_STATUS[s].rotulo.length).toBeGreaterThan(0)
      expect(['neutro', 'info', 'aviso', 'perigo']).toContain(ROTULO_STATUS[s].tom)
    }
  })

  test('só entregue e devolvido são terminais', () => {
    expect(TODOS.filter(ehTerminal).sort()).toEqual(['devolvido', 'entregue'])
  })

  test('terminais não têm avanços', () => {
    expect(avancosDe('entregue')).toEqual([])
    expect(avancosDe('devolvido')).toEqual([])
  })

  test('todo estado não terminal tem ao menos um avanço', () => {
    for (const s of TODOS.filter((x) => !ehTerminal(x))) {
      expect(avancosDe(s).length).toBeGreaterThan(0)
    }
  })
})
