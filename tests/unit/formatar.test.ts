import { describe, it, expect } from 'vitest'
import { formatarDataHora } from '@/lib/formatar'

describe('formatarDataHora', () => {
  it('mostra data e hora no horário de Brasília', () => {
    expect(formatarDataHora('2026-11-25T17:32:00Z')).toBe('25/11/2026 14:32')
  })

  it('virada de dia respeita o fuso', () => {
    expect(formatarDataHora('2026-11-26T02:05:00Z')).toBe('25/11/2026 23:05')
  })

  it('valor inválido volta como veio', () => {
    expect(formatarDataHora('ontem')).toBe('ontem')
  })
})
