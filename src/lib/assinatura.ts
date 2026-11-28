import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dependencias } from '@/lib/os'
import { erroDoBanco, FALHA_SALVAR, type Resultado } from '@/lib/resultado'

/**
 * Assinatura do cliente (spec 8.2): PNG desenhado com o dedo, um por momento, no bucket
 * `os_arquivos`. Refazer regrava o mesmo arquivo. As regras de quando pode assinar estão no banco.
 */

export type MomentoAssinatura = 'entrada' | 'entrega'
export const MOMENTOS_ASSINATURA: MomentoAssinatura[] = ['entrada', 'entrega']
const TAMANHO_MAXIMO = 512 * 1024

export async function salvarAssinaturaCom(
  deps: Dependencias,
  osId: string,
  momento: string,
  arquivo: unknown,
): Promise<Resultado> {
  if (!osId || !MOMENTOS_ASSINATURA.includes(momento as MomentoAssinatura)) return { ok: false, erro: 'Dados inválidos' }
  if (!(arquivo instanceof File) || arquivo.type !== 'image/png' || arquivo.size === 0 || arquivo.size > TAMANHO_MAXIMO)
    return { ok: false, erro: 'Assine no quadro antes de salvar.' }
  const membro = await deps.membroDaSessao()
  if (!membro) return { ok: false, erro: 'Acesso negado' }

  const caminho = `${membro.lojaId}/${osId}/assinatura-${momento}.png`
  // Registro primeiro: é ele que confere se a OS ainda aceita assinatura neste momento.
  const { error } = await deps.supabase
    .from('os_assinaturas')
    .upsert({ os_id: osId, loja_id: membro.lojaId, momento, caminho, criado_em: new Date().toISOString() }, { onConflict: 'os_id,momento' })
  if (error) return erroDoBanco(error)
  const envio = await deps.supabase.storage.from('os_arquivos').upload(caminho, arquivo, { upsert: true, contentType: 'image/png' })
  return envio.error ? { ok: false, erro: FALHA_SALVAR } : { ok: true }
}

/** Endereços assinados (1 hora) das assinaturas da OS, por momento. */
export async function carregarAssinaturasCom(
  supabase: SupabaseClient,
  osId: string,
): Promise<Partial<Record<MomentoAssinatura, string>>> {
  const { data } = await supabase.from('os_assinaturas').select('momento, caminho').eq('os_id', osId)
  const linhas = (data ?? []) as { momento: MomentoAssinatura; caminho: string }[]
  if (!linhas.length) return {}
  const { data: assinadas } = await supabase.storage.from('os_arquivos').createSignedUrls(linhas.map((l) => l.caminho), 60 * 60)
  const urls = new Map((assinadas ?? []).map((a) => [a.path, a.signedUrl]))
  return Object.fromEntries(linhas.map((l) => [l.momento, urls.get(l.caminho)]).filter(([, u]) => u))
}
