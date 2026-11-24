import { describe, it, expect } from 'vitest'
import { montarLinkDefinirSenha } from '@/lib/auth-links'

describe('montarLinkDefinirSenha', () => {
  it('monta a URL com token_hash e type=recovery', () => {
    expect(montarLinkDefinirSenha('https://app.exemplo.com', 'abc123')).toBe(
      'https://app.exemplo.com/definir-senha?token_hash=abc123&type=recovery',
    )
  })
  it('remove barra final da origem e codifica o token', () => {
    expect(montarLinkDefinirSenha('http://localhost:3000/', 'a+b/c')).toBe(
      'http://localhost:3000/definir-senha?token_hash=a%2Bb%2Fc&type=recovery',
    )
  })
})
