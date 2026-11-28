import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('QR do link', () => {
  it('gera um SVG para o endereço', async () => {
    const { gerarQrSvg } = await import('@/lib/qr')
    const svg = await gerarQrSvg('https://loja.exemplo/acompanhar/' + 'a'.repeat(48))
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('<path')
  })

  it('endereços diferentes, desenhos diferentes', async () => {
    const { gerarQrSvg } = await import('@/lib/qr')
    expect(await gerarQrSvg('https://a.b/1')).not.toBe(await gerarQrSvg('https://a.b/2'))
  })
})
