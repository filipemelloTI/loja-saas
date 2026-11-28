'use server'

import { refresh } from 'next/cache'
import { tokenValido } from '@/lib/acompanhamento'
import { erroDoBanco, type Resultado } from '@/lib/resultado'
import { criarClienteAnonimo } from '@/lib/supabase/anonimo'

/** Resposta do cliente ao orçamento, pelo link público. Toda a conferência é da função do banco. */
export async function responderOrcamento(token: string, orcamentoId: string, aprova: boolean, nome: string): Promise<Resultado> {
  if (!tokenValido(token) || !orcamentoId) return { ok: false, erro: 'Link não encontrado.' }
  const nomeLimpo = nome.trim()
  if (aprova && !nomeLimpo) return { ok: false, erro: 'Informe seu nome para aprovar.' }

  const { error } = await criarClienteAnonimo().rpc('responder_orcamento_pelo_link', {
    token,
    orc: orcamentoId,
    aprova,
    nome: nomeLimpo || null,
  })
  if (error) return erroDoBanco(error)
  refresh()
  return { ok: true }
}
