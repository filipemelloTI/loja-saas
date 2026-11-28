import type { SupabaseClient } from '@supabase/supabase-js'
import type { Dependencias } from '@/lib/os'
import { erroDoBanco, FALHA_SALVAR, type Resultado } from '@/lib/resultado'

/**
 * Fotos do aparelho (spec 8.2). O navegador reduz a foto antes de enviar (`dimensionar`); o servidor
 * grava no bucket privado `os_arquivos`, em `<loja>/<os>/<id>.<ext>`, e registra em `os_fotos`. O
 * banco limita 8 por momento e não deixa apagar de OS encerrada.
 */

export type Momento = 'entrada' | 'saida'
export const MOMENTOS: Momento[] = ['entrada', 'saida']
export const ROTULO_MOMENTO: Record<Momento, string> = { entrada: 'Na entrada', saida: 'Na saída' }

export const LADO_MAXIMO = 1600
export const TAMANHO_MAXIMO_FOTO = 2 * 1024 * 1024
const TIPOS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Tamanho final mantendo a proporção, com o lado maior no máximo `max`. Nunca aumenta. */
export function dimensionar(largura: number, altura: number, max = LADO_MAXIMO): { largura: number; altura: number } {
  const maior = Math.max(largura, altura)
  if (maior <= max) return { largura, altura }
  const f = max / maior
  return { largura: Math.round(largura * f), altura: Math.round(altura * f) }
}

export type Foto = { id: string; momento: Momento; url: string | null; criadoEm: string }

const ACESSO_NEGADO = { ok: false, erro: 'Acesso negado' } as const

export async function enviarFotoCom(deps: Dependencias, osId: string, momento: string, arquivo: unknown): Promise<Resultado> {
  if (!osId || !MOMENTOS.includes(momento as Momento)) return { ok: false, erro: 'Dados inválidos' }
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: 'Escolha uma foto.' }
  const ext = TIPOS[arquivo.type]
  if (!ext) return { ok: false, erro: 'Use uma foto JPG, PNG ou WebP.' }
  if (arquivo.size > TAMANHO_MAXIMO_FOTO) return { ok: false, erro: 'A foto ficou grande demais. Tire de novo.' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO

  const caminho = `${membro.lojaId}/${osId}/${crypto.randomUUID()}.${ext}`
  const bucket = deps.supabase.storage.from('os_arquivos')
  const envio = await bucket.upload(caminho, arquivo, { contentType: arquivo.type })
  if (envio.error) return { ok: false, erro: FALHA_SALVAR }

  const { error } = await deps.supabase
    .from('os_fotos')
    .insert({ loja_id: membro.lojaId, os_id: osId, momento, caminho })
  if (error) {
    // Sem registro, o arquivo ficaria solto no bucket.
    await bucket.remove([caminho])
    return erroDoBanco(error)
  }
  return { ok: true }
}

export async function removerFotoCom(deps: Dependencias, fotoId: string): Promise<Resultado> {
  if (!fotoId) return { ok: false, erro: 'Dados inválidos' }
  const membro = await deps.membroDaSessao()
  if (!membro) return ACESSO_NEGADO
  const { data, error } = await deps.supabase
    .from('os_fotos')
    .delete()
    .eq('id', fotoId)
    .eq('loja_id', membro.lojaId)
    .select('caminho')
  if (error) return erroDoBanco(error)
  const caminho = (data as { caminho: string }[] | null)?.[0]?.caminho
  if (!caminho) return { ok: false, erro: 'Foto não encontrada' }
  await deps.supabase.storage.from('os_arquivos').remove([caminho])
  return { ok: true }
}

/** Fotos da OS com endereço assinado (1 hora), em ordem de envio. */
export async function carregarFotosCom(supabase: SupabaseClient, osId: string): Promise<Foto[]> {
  const { data } = await supabase
    .from('os_fotos')
    .select('id, momento, caminho, criado_em')
    .eq('os_id', osId)
    .order('criado_em')
  const linhas = (data ?? []) as { id: string; momento: Momento; caminho: string; criado_em: string }[]
  if (!linhas.length) return []
  const { data: assinadas } = await supabase.storage
    .from('os_arquivos')
    .createSignedUrls(linhas.map((l) => l.caminho), 60 * 60)
  const urls = new Map((assinadas ?? []).map((a) => [a.path, a.signedUrl]))
  return linhas.map((l) => ({ id: l.id, momento: l.momento, url: urls.get(l.caminho) ?? null, criadoEm: l.criado_em }))
}
