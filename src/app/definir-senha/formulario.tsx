'use client'

import { useEffect, useState } from 'react'
import { criarClienteNavegador } from '@/lib/supabase/navegador'
import { definirSenha } from '@/lib/auth-acoes'

const MENSAGENS: Record<string, string> = {
  curta: 'A senha precisa ter no mínimo 8 caracteres.',
  diferente: 'As senhas não conferem.',
  link: 'Link inválido ou expirado. Peça um novo link.',
}

export function FormularioSenha({ erro }: { erro?: string }) {
  const [pronto, setPronto] = useState(false)
  const [semSessao, setSemSessao] = useState(false)

  useEffect(() => {
    const supabase = criarClienteNavegador()
    async function preparar() {
      // O link de recuperação traz ?token_hash=...&type=recovery ou tokens no hash da URL.
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      if (tokenHash) {
        await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      }
      const { data } = await supabase.auth.getSession()
      if (data.session) setPronto(true)
      else setSemSessao(true)
    }
    preparar()
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Definir senha</h1>
      {erro && MENSAGENS[erro] && <p role="alert" className="text-red-600">{MENSAGENS[erro]}</p>}
      {semSessao && !erro && <p role="alert" className="text-red-600">{MENSAGENS.link}</p>}
      {pronto && (
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
