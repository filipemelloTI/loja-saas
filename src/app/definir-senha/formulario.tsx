'use client'

import { useEffect, useRef, useState } from 'react'
import { criarClienteNavegador } from '@/lib/supabase/navegador'
import { definirSenha } from '@/lib/auth-acoes'

const MENSAGENS: Record<string, string> = {
  curta: 'A senha precisa ter no mínimo 8 caracteres.',
  diferente: 'As senhas não conferem.',
  link: 'Link inválido ou expirado. Peça um novo link.',
}

export function FormularioSenha({ erro }: { erro?: string }) {
  const [pronto, setPronto] = useState(false)
  const [linkInvalido, setLinkInvalido] = useState(false)
  // verifyOtp consome o token de uso único: precisa rodar UMA vez. Em dev o Strict Mode
  // invoca o efeito duas vezes; sem esta trava a 2ª chamada falha ("link inválido") por
  // tentar reusar o token já gasto. O ref persiste entre as duas invocações.
  const jaPreparou = useRef(false)

  useEffect(() => {
    if (jaPreparou.current) return
    jaPreparou.current = true
    // Contrato: /definir-senha?token_hash=<hashed_token>&type=recovery (ver montarLinkDefinirSenha).
    // Nunca aproveita sessão já existente: sem token válido, não mostra o formulário.
    async function preparar() {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      if (!tokenHash || params.get('type') !== 'recovery') {
        setLinkInvalido(true)
        return
      }
      const { error } = await criarClienteNavegador().auth.verifyOtp({
        token_hash: tokenHash,
        type: 'recovery',
      })
      if (error) setLinkInvalido(true)
      else setPronto(true)
    }
    preparar()
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Definir senha</h1>
      {erro && MENSAGENS[erro] && <p role="alert" className="text-red-600">{MENSAGENS[erro]}</p>}
      {linkInvalido && !erro && <p role="alert" className="text-red-600">{MENSAGENS.link}</p>}
      {pronto && !linkInvalido && (
        <form action={definirSenha} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            Nova senha (mínimo 8 caracteres)
            <input name="senha" type="password" required minLength={8} autoComplete="new-password" className="rounded border p-2" />
          </label>
          <label className="flex flex-col gap-1">
            Repita a senha
            <input name="confirma" type="password" required minLength={8} autoComplete="new-password" className="rounded border p-2" />
          </label>
          <button type="submit" className="rounded bg-black p-2 text-white">Salvar senha</button>
        </form>
      )}
    </main>
  )
}
