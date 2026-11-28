import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { dimensionar, enviarFotoCom, removerFotoCom, TAMANHO_MAXIMO_FOTO } from '@/lib/fotos'
import type { Dependencias } from '@/lib/os'
import { FALHA_SALVAR } from '@/lib/resultado'

describe('redimensionar', () => {
  it('foto deitada de celular cai para 1600 de largura, na proporção', () => {
    expect(dimensionar(4032, 3024)).toEqual({ largura: 1600, altura: 1200 })
  })
  it('foto em pé: o lado maior é a altura', () => {
    expect(dimensionar(3024, 4032)).toEqual({ largura: 1200, altura: 1600 })
  })
  it('foto pequena não é ampliada', () => {
    expect(dimensionar(800, 600)).toEqual({ largura: 800, altura: 600 })
  })
})

function falso({ upload = { error: null }, insert = { error: null }, del = { data: [{ caminho: 'L1/OS1/a.jpg' }], error: null } } = {}) {
  const remove = vi.fn(async () => ({ error: null }))
  const bucket = { upload: vi.fn(async () => upload), remove }
  const cadeia: Record<string, unknown> = {}
  for (const m of ['delete', 'eq', 'select']) cadeia[m] = vi.fn(() => cadeia)
  cadeia.insert = vi.fn(async () => insert)
  cadeia.then = (ok: (r: unknown) => unknown) => Promise.resolve(del).then(ok)
  const supabase = { from: vi.fn(() => cadeia), storage: { from: vi.fn(() => bucket) } }
  const d: Dependencias = {
    membroDaSessao: vi.fn(async () => ({ lojaId: 'L1', perfil: 'atendente' as const })),
    supabase: supabase as unknown as SupabaseClient,
  }
  return { d, bucket, cadeia }
}

const foto = (tipo = 'image/jpeg', tamanho = 1000) => new File([new Uint8Array(tamanho)], 'f', { type: tipo })

describe('enviar foto', () => {
  it('recusa formato e tamanho antes de qualquer envio', async () => {
    const { d, bucket } = falso()
    expect(await enviarFotoCom(d, 'OS1', 'entrada', foto('image/heic'))).toEqual({ ok: false, erro: 'Use uma foto JPG, PNG ou WebP.' })
    expect((await enviarFotoCom(d, 'OS1', 'entrada', foto('image/jpeg', TAMANHO_MAXIMO_FOTO + 1))).ok).toBe(false)
    expect(await enviarFotoCom(d, 'OS1', 'depois', foto())).toEqual({ ok: false, erro: 'Dados inválidos' })
    expect(bucket.upload).not.toHaveBeenCalled()
  })

  it('grava na pasta da loja e da OS e registra o momento', async () => {
    const { d, bucket, cadeia } = falso()
    expect(await enviarFotoCom(d, 'OS1', 'saida', foto())).toEqual({ ok: true })
    const caminho = (bucket.upload.mock.calls[0] as unknown[])[0] as string
    expect(caminho).toMatch(/^L1\/OS1\/[0-9a-f-]{36}\.jpg$/)
    expect(cadeia.insert).toHaveBeenCalledWith({ loja_id: 'L1', os_id: 'OS1', momento: 'saida', caminho })
  })

  it('se o registro falha, o arquivo enviado é apagado e o motivo chega em português', async () => {
    const limite = 'Já há 8 fotos neste momento. Apague uma para enviar outra.'
    const { d, bucket } = falso({ insert: { error: { message: limite, code: 'P0001' } } as never })
    expect(await enviarFotoCom(d, 'OS1', 'entrada', foto())).toEqual({ ok: false, erro: limite })
    expect(bucket.remove).toHaveBeenCalled()
  })

  it('falha no envio do arquivo: mensagem genérica, nada registrado', async () => {
    const { d, cadeia } = falso({ upload: { error: { message: 'x' } } as never })
    expect(await enviarFotoCom(d, 'OS1', 'entrada', foto())).toEqual({ ok: false, erro: FALHA_SALVAR })
    expect(cadeia.insert).not.toHaveBeenCalled()
  })
})

describe('remover foto', () => {
  it('apaga o registro na loja da sessão e depois o arquivo', async () => {
    const { d, bucket, cadeia } = falso()
    expect(await removerFotoCom(d, 'F1')).toEqual({ ok: true })
    expect(cadeia.eq).toHaveBeenCalledWith('loja_id', 'L1')
    expect(bucket.remove).toHaveBeenCalledWith(['L1/OS1/a.jpg'])
  })
})
