import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PADRAO_MATCHER } from '@/lib/matcher'

const re = new RegExp('^' + PADRAO_MATCHER + '$')

describe('matcher do proxy', () => {
  it('passa pelo proxy rotas reais, inclusive as terminadas em "ico"', () => {
    for (const r of ['/', '/servico', '/configuracoes', '/login', '/plataforma/lojas']) {
      expect(re.test(r), r).toBe(true)
    }
  })
  it('ignora estáticos', () => {
    for (const r of ['/logo.png', '/favicon.ico', '/_next/static/x.js', '/img/a.svg']) {
      expect(re.test(r), r).toBe(false)
    }
  })
  it('é idêntico ao config de src/proxy.ts', () => {
    const src = readFileSync('src/proxy.ts', 'utf8')
    const m = src.match(/matcher: \['(.*)'\]/)![1]
    expect(m.split('\\\\').join('\\')).toBe(PADRAO_MATCHER)
  })
})
