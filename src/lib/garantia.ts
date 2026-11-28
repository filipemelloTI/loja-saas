/**
 * Contas de garantia (spec 8.7). O prazo conta do dia da entrega, no horário da loja (Brasília),
 * igual à função `abrir_os_garantia` do banco: o dia do vencimento ainda vale.
 */

/** Quantos dias antes do vencimento a garantia aparece como "vencendo". */
export const AVISO_GARANTIA_DIAS = 15

export type Situacao = 'vigente' | 'vencendo' | 'vencida'
export type SituacaoGarantia = { venceEm: string; diasRestantes: number; situacao: Situacao }

const diaDaLoja = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Instante → data (`AAAA-MM-DD`) no horário de Brasília. */
export function dataNaLoja(instante: Date | string): string {
  return diaDaLoja.format(typeof instante === 'string' ? new Date(instante) : instante)
}

function emDias(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number)
  return Date.UTC(a, m - 1, d) / 86_400_000
}

export function somarDias(iso: string, dias: number): string {
  return new Date((emDias(iso) + dias) * 86_400_000).toISOString().slice(0, 10)
}

export function situacaoGarantia(encerradaEm: string, dias: number, hoje: Date = new Date()): SituacaoGarantia {
  const venceEm = somarDias(dataNaLoja(encerradaEm), dias)
  const diasRestantes = emDias(venceEm) - emDias(dataNaLoja(hoje))
  const situacao: Situacao = diasRestantes < 0 ? 'vencida' : diasRestantes <= AVISO_GARANTIA_DIAS ? 'vencendo' : 'vigente'
  return { venceEm, diasRestantes, situacao }
}

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  vigente: 'Em garantia',
  vencendo: 'Vencendo',
  vencida: 'Vencida',
}
