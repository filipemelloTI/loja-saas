import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

const headersMock = vi.fn()
vi.mock('next/headers', () => ({ headers: () => headersMock() }))

import { origemDoSite } from '@/lib/origem'

const cabecalhos = (map: Record<string, string>) => ({ get: (k: string) => map[k] ?? null })

describe('origemDoSite', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('usa NEXT_PUBLIC_SITE_URL quando definida, removendo a barra final e sem ler cabeçalhos', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.exemplo.com/')
    expect(await origemDoSite()).toBe('https://app.exemplo.com')
    expect(headersMock).not.toHaveBeenCalled()
  })

  it('produção sem a variável: lança erro em português e nunca cai para os cabeçalhos', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    await expect(origemDoSite()).rejects.toThrow('NEXT_PUBLIC_SITE_URL não configurada')
    expect(headersMock).not.toHaveBeenCalled()
  })

  it('desenvolvimento sem a variável: cai para os cabeçalhos da requisição', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('NODE_ENV', 'development')
    headersMock.mockReturnValue(cabecalhos({ host: 'localhost:3000' }))
    expect(await origemDoSite()).toBe('http://localhost:3000')
  })
})
