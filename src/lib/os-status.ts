import type { TomSelo } from '@/components/ui/Selo'
import type { Perfil } from './tipos'

/** Os 11 valores do enum `public.status_os` do banco, na mesma ordem. */
export type StatusOS =
  | 'aberta'
  | 'em_analise'
  | 'orcamento_enviado'
  | 'aprovado'
  | 'recusado'
  | 'aguardando_peca'
  | 'em_servico'
  | 'pronto'
  | 'pronto_devolucao'
  | 'entregue'
  | 'devolvido'

export const ROTULO_STATUS: Record<StatusOS, { rotulo: string; tom: TomSelo }> = {
  aberta: { rotulo: 'Aberta', tom: 'neutro' },
  em_analise: { rotulo: 'Em análise', tom: 'info' },
  orcamento_enviado: { rotulo: 'Orçamento enviado', tom: 'info' },
  aprovado: { rotulo: 'Aprovado', tom: 'info' },
  recusado: { rotulo: 'Recusado', tom: 'perigo' },
  aguardando_peca: { rotulo: 'Aguardando peça', tom: 'aviso' },
  em_servico: { rotulo: 'Em serviço', tom: 'info' },
  pronto: { rotulo: 'Pronto', tom: 'info' },
  pronto_devolucao: { rotulo: 'Pronto para devolver', tom: 'aviso' },
  entregue: { rotulo: 'Entregue', tom: 'neutro' },
  devolvido: { rotulo: 'Devolvido', tom: 'neutro' },
}

/** Avanços permitidos a partir de cada etapa. É a única fonte de verdade da máquina. */
const AVANCOS: Record<StatusOS, StatusOS[]> = {
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

export function ehTerminal(s: StatusOS): boolean {
  return AVANCOS[s].length === 0
}

export function avancosDe(s: StatusOS): StatusOS[] {
  return [...AVANCOS[s]]
}

/** `alvo` é alcançável a partir de `origem` seguindo só avanços? */
function alcanca(origem: StatusOS, alvo: StatusOS): boolean {
  const visitados = new Set<StatusOS>()
  const fila = [origem]
  while (fila.length) {
    const atual = fila.pop() as StatusOS
    for (const prox of AVANCOS[atual]) {
      if (prox === alvo) return true
      if (!visitados.has(prox)) {
        visitados.add(prox)
        fila.push(prox)
      }
    }
  }
  return false
}

export function podeMudar(
  de: StatusOS,
  para: StatusOS,
  perfil: Perfil,
): { ok: true } | { ok: false; erro: string } {
  if (ehTerminal(de)) return { ok: false, erro: 'A OS já foi encerrada' }
  if (AVANCOS[de].includes(para)) return { ok: true }
  if (alcanca(para, de)) {
    return perfil === 'dono' ? { ok: true } : { ok: false, erro: 'Só o Dono pode voltar uma etapa' }
  }
  return { ok: false, erro: 'Essa mudança de etapa não é permitida' }
}
