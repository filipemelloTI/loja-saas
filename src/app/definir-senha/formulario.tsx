'use client'

import { useEffect, useRef, useState } from 'react'
import { Marca } from '@/components/Marca'
import { Alerta } from '@/components/ui/Avisos'
import { Roda } from '@/components/ui/Botao'
import { BotaoEnviar } from '@/components/ui/BotaoEnviar'
import { Campo, TodosObrigatorios } from '@/components/ui/Campo'
import { Cartao } from '@/components/ui/Cartao'
import { criarClienteNavegador } from '@/lib/supabase/navegador'
import { definirSenha } from '@/lib/auth-acoes'

const MENSAGENS: Record<string, string> = {
  curta: 'A senha precisa ter no mínimo 8 caracteres.',
  diferente: 'As senhas não conferem.',
  link: 'Link inválido ou expirado. Peça um novo link para quem te convidou.',
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

  const validando = !pronto && !linkInvalido

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <Marca comDescricao />
      <Cartao titulo="Criar sua senha">
        <div className="flex flex-col gap-4">
          {erro && MENSAGENS[erro] && <Alerta>{MENSAGENS[erro]}</Alerta>}
          {linkInvalido && !erro && <Alerta>{MENSAGENS.link}</Alerta>}

          {validando && (
            <p role="status" className="flex items-center gap-2 text-tinta-suave">
              <Roda />
              Validando o seu link…
            </p>
          )}

          {pronto && !linkInvalido && (
            <form action={definirSenha} className="flex flex-col gap-4">
              <TodosObrigatorios />
              <Campo
                name="senha"
                rotulo="Nova senha"
                dica="Mínimo de 8 caracteres."
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <Campo
                name="confirma"
                rotulo="Repita a senha"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <BotaoEnviar rotuloCarregando="Salvando…" className="w-full">
                Salvar senha e entrar
              </BotaoEnviar>
            </form>
          )}
        </div>
      </Cartao>
    </main>
  )
}
