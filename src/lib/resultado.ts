import type { z } from 'zod'

/** Resultado de uma ação de gravação, compartilhado pelos módulos (Configurações, Clientes, OS). */
export type Resultado = { ok: true } | { ok: false; erro: string }

export const FALHA_SALVAR = 'Não foi possível salvar. Tente de novo.'

/** Erro do banco para a tela: os triggers (P0001) já falam português; o resto vira mensagem genérica. */
export function erroDoBanco(erro: { code?: string; message: string }): { ok: false; erro: string } {
  return { ok: false, erro: erro.code === 'P0001' ? erro.message : FALHA_SALVAR }
}

export function primeiroErro(e: z.ZodError) {
  return e.issues[0]?.message ?? 'Dados inválidos'
}
