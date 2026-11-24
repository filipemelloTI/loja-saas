import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Lê `.env.local` para dentro de `process.env` (sem depender de dotenv).
 * O `next dev` já lê esse arquivo sozinho; isto é só para o globalSetup e o config
 * do Playwright, que rodam em Node puro e precisam da service role e das URLs.
 */
export function carregarEnvLocal(): void {
  try {
    const texto = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const linha of texto.split(/\r?\n/)) {
      const corte = linha.indexOf('=')
      if (corte < 0 || linha.trimStart().startsWith('#')) continue
      const chave = linha.slice(0, corte).trim()
      const valor = linha.slice(corte + 1).trim()
      if (chave && process.env[chave] === undefined) process.env[chave] = valor
    }
  } catch {
    // Sem .env.local: os valores precisam vir do ambiente.
  }
}

export function env(chave: string): string {
  const valor = process.env[chave]
  if (!valor) throw new Error(`Variável de ambiente ausente: ${chave}. Confira o .env.local.`)
  return valor
}
