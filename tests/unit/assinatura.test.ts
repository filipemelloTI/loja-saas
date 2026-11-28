import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { salvarAssinaturaCom } from '@/lib/assinatura'
import type { Dependencias } from '@/lib/os'

function falso(upsert: { error: unknown } = { error: null }) {
  const bucket = { upload: vi.fn(async () => ({ error: null })) }
  const cadeia = { upsert: vi.fn(async () => upsert) }
  const supabase = { from: vi.fn(() => cadeia), storage: { from: vi.fn(() => bucket) } }
  const d: Dependencias = {
    membroDaSessao: vi.fn(async () => ({ lojaId: 'L1', perfil: 'atendente' as const })),
    supabase: supabase as unknown as SupabaseClient,
  }
  return { d, bucket, cadeia }
}
const png = (n = 100) => new File([new Uint8Array(n)], 'a.png', { type: 'image/png' })

describe('assinatura', () => {
  it('sem desenho ou com outro formato, nada é gravado', async () => {
    const { d, cadeia } = falso()
    expect((await salvarAssinaturaCom(d, 'OS1', 'entrada', png(0))).ok).toBe(false)
    expect((await salvarAssinaturaCom(d, 'OS1', 'entrada', new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).ok).toBe(false)
    expect((await salvarAssinaturaCom(d, 'OS1', 'saida', png())).ok).toBe(false)
    expect(cadeia.upsert).not.toHaveBeenCalled()
  })

  it('registra e regrava o arquivo do momento na pasta da OS', async () => {
    const { d, bucket, cadeia } = falso()
    expect(await salvarAssinaturaCom(d, 'OS1', 'entrega', png())).toEqual({ ok: true })
    expect(cadeia.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ os_id: 'OS1', loja_id: 'L1', momento: 'entrega', caminho: 'L1/OS1/assinatura-entrega.png' }),
      { onConflict: 'os_id,momento' },
    )
    expect(bucket.upload).toHaveBeenCalledWith('L1/OS1/assinatura-entrega.png', expect.any(File), { upsert: true, contentType: 'image/png' })
  })

  it('se o banco recusa (OS não pronta), o arquivo nem é enviado', async () => {
    const regra = 'A assinatura de entrega é feita com a OS pronta.'
    const { d, bucket } = falso({ error: { message: regra, code: 'P0001' } })
    expect(await salvarAssinaturaCom(d, 'OS1', 'entrega', png())).toEqual({ ok: false, erro: regra })
    expect(bucket.upload).not.toHaveBeenCalled()
  })
})
