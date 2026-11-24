import { Suspense } from 'react'
import Link from 'next/link'
import { Cartao } from '@/components/ui/Cartao'
import { Icone, type NomeIcone } from '@/components/Icone'
import { contextoAtual } from '@/lib/sessao'
import { perfilEfetivo } from '@/lib/guarda'
import { itensMenu } from '@/lib/menu'

export default function Inicio() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<h1 className="font-titulo text-3xl font-bold tracking-tight">Início</h1>}>
        <Saudacao />
      </Suspense>

      <Cartao titulo="Avisos de hoje">
        <p className="max-w-prose text-tinta-suave">
          Nada por aqui ainda. Aparelhos prontos para entrega, estoque acabando e contas a vencer vão aparecer
          nesta lista.
        </p>
      </Cartao>

      <Suspense fallback={null}>
        <Atalhos />
      </Suspense>
    </div>
  )
}

async function Saudacao() {
  const ctx = await contextoAtual()
  const primeiroNome = ctx?.membro?.nome.split(' ')[0]
  return (
    <h1 className="font-titulo text-3xl font-bold tracking-tight">
      {primeiroNome ? `Olá, ${primeiroNome}` : 'Início'}
    </h1>
  )
}

async function Atalhos() {
  const ctx = await contextoAtual()
  const perfil = ctx ? perfilEfetivo(ctx) : null
  if (!ctx?.loja || !perfil) return null // o layout já redireciona
  const atalhos = itensMenu(perfil, ctx.loja.modulos).filter((i) => i.href !== '/')

  return (
    <nav aria-label="Atalhos">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {atalhos.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="flex min-h-20 flex-col justify-between gap-3 rounded-xl border border-linha bg-superficie p-4 font-semibold transition-colors hover:border-marca hover:bg-marca-suave"
            >
              <Icone nome={a.area as NomeIcone} className="size-6 text-marca" />
              {a.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
