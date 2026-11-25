import { Suspense } from 'react'
import Link from 'next/link'
import { Cartao, Sobrancelha } from '@/components/ui/Cartao'
import { Icone, type NomeIcone } from '@/components/Icone'
import { contextoAtual } from '@/lib/sessao'
import { perfilEfetivo } from '@/lib/guarda'
import { itensMenu } from '@/lib/menu'

export default function Inicio() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense
        fallback={<h1 className="font-titulo text-3xl font-bold tracking-tight">Início</h1>}
      >
        <Saudacao />
      </Suspense>

      <Cartao etiqueta="Hoje" titulo="Avisos">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-superficie-2 text-tinta-suave">
            <Icone nome="inicio" className="size-5" />
          </span>
          <p className="max-w-prose text-pretty text-tinta-suave">
            Nada por aqui ainda. Aparelhos prontos para entrega, estoque acabando e contas a
            vencer vão aparecer nesta lista.
          </p>
        </div>
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
  const hoje = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })

  return (
    <div className="flex flex-col gap-1.5">
      <Sobrancelha>{hoje}</Sobrancelha>
      <h1 className="font-titulo text-3xl font-bold tracking-tight text-balance">
        {primeiroNome ? `Olá, ${primeiroNome}` : 'Início'}
      </h1>
    </div>
  )
}

async function Atalhos() {
  const ctx = await contextoAtual()
  const perfil = ctx ? perfilEfetivo(ctx) : null
  if (!ctx?.loja || !perfil) return null // o layout já redireciona
  const atalhos = itensMenu(perfil, ctx.loja.modulos).filter((i) => i.href !== '/')

  return (
    <nav aria-label="Atalhos" className="flex flex-col gap-3">
      <Sobrancelha>Ir para</Sobrancelha>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {atalhos.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className={
                'realce group flex min-h-24 flex-col justify-between gap-3 rounded-xl border ' +
                'border-linha bg-superficie p-4 transition-colors hover:border-marca hover:bg-marca-suave'
              }
            >
              <span className="grid size-10 place-items-center rounded-lg bg-marca-suave text-marca transition-colors group-hover:bg-marca group-hover:text-sobre-marca">
                <Icone nome={a.area as NomeIcone} className="size-5" />
              </span>
              <span className="font-titulo font-semibold text-tinta">{a.rotulo}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
