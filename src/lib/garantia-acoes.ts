import type { Dependencias } from '@/lib/os'
import { erroDoBanco, type Resultado } from '@/lib/resultado'

/**
 * Ações de garantia: o Dono ajusta o prazo antes da entrega; qualquer perfil abre OS de garantia
 * (a função do banco confere entrega, prazo e loja). Travas também no banco.
 */

const ACESSO_NEGADO = { ok: false, erro: 'Acesso negado' } as const
export const SO_DONO_GARANTIA = 'Só o Dono ajusta o prazo de garantia.'

/** `dias = null` volta ao prazo automático (catálogo ou padrão da loja). */
export async function ajustarGarantiaCom(deps: Dependencias, osId: string, dias: number | null): Promise<Resultado> {
  if (!osId) return { ok: false, erro: 'Dados inválidos' }
  if (dias !== null && (!Number.isInteger(dias) || dias < 0 || dias > 3650))
    return { ok: false, erro: 'Informe o prazo em dias (de 0 a 3650).' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO
  if (membro.perfil !== 'dono') return { ok: false, erro: SO_DONO_GARANTIA }

  const { data, error } = await deps.supabase
    .from('ordens_servico')
    .update({ garantia_ajuste_dias: dias })
    .eq('id', osId)
    .eq('loja_id', membro.lojaId)
    .select('id')
  if (error) return erroDoBanco(error)
  return data?.length ? { ok: true } : { ok: false, erro: 'OS não encontrada' }
}

export async function abrirGarantiaCom(
  deps: Dependencias,
  osId: string,
  defeito: string,
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  if (!osId) return { ok: false, erro: 'Dados inválidos' }
  if (!defeito.trim()) return { ok: false, erro: 'Descreva o problema que voltou.' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO
  const { data, error } = await deps.supabase.rpc('abrir_os_garantia', { os: osId, defeito: defeito.trim() })
  if (error) return erroDoBanco(error)
  return { ok: true, id: data as string }
}
