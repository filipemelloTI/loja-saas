import type { ReactNode } from 'react'
import Link from 'next/link'
import { Selo } from '@/components/ui/Selo'
import { TabelaResponsiva } from '@/components/ui/TabelaResponsiva'
import { formatarDataISO } from '@/lib/formatar'
import type { ResumoOS } from '@/lib/os'
import { ROTULO_STATUS, type StatusOS } from '@/lib/os-status'
import { ROTULO_APARELHO } from '@/lib/rotulos'

const ESTADOS = Object.keys(ROTULO_STATUS) as StatusOS[]
const LIMITE_LISTA = 200 // mesmo teto de `listarOSCom`

function Chip({ href, ativo, children }: { href: string; ativo: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={ativo ? 'true' : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-0.5 ${ativo ? 'ring-2 ring-marca' : 'opacity-80 hover:opacity-100'}`}
    >
      {children}
    </Link>
  )
}

export function ListaOS({
  ordens,
  filtro,
  somenteLeitura,
}: {
  ordens: ResumoOS[]
  filtro?: StatusOS
  somenteLeitura: boolean
}) {
  const vazio = filtro
    ? `Nenhuma OS na etapa “${ROTULO_STATUS[filtro].rotulo}”. Escolha outra etapa acima ou veja todas.`
    : somenteLeitura
      ? 'Nenhuma OS nesta loja ainda.'
      : 'Nenhuma OS aberta ainda. Toque em “Nova OS” para receber o primeiro aparelho.'

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Filtrar por etapa" className="flex flex-wrap gap-x-1 gap-y-0.5">
        <Chip href="/servico" ativo={!filtro}>
          <Selo>Todas</Selo>
        </Chip>
        {ESTADOS.map((s) => (
          <Chip key={s} href={`/servico?estado=${s}`} ativo={filtro === s}>
            <Selo tom={ROTULO_STATUS[s].tom}>{ROTULO_STATUS[s].rotulo}</Selo>
          </Chip>
        ))}
      </nav>

      <TabelaResponsiva
        legenda="Ordens de serviço da loja"
        linhas={ordens}
        chave={(o) => o.id}
        vazio={vazio}
        colunas={[
          {
            titulo: 'Nº',
            valor: (o) => (
              <Link href={`/servico/${o.id}`} className="numeros inline-flex min-h-11 items-center text-marca hover:underline">
                Nº {o.numero}
              </Link>
            ),
          },
          { titulo: 'Cliente', valor: (o) => o.clienteNome ?? (o.interna ? 'OS interna' : '—') },
          {
            titulo: 'Aparelho',
            valor: (o) => [ROTULO_APARELHO[o.aparelhoTipo] ?? 'Aparelho', o.marca, o.modelo].filter(Boolean).join(' · '),
          },
          { titulo: 'Status', valor: (o) => <Selo tom={ROTULO_STATUS[o.status]?.tom}>{ROTULO_STATUS[o.status]?.rotulo ?? 'Em andamento'}</Selo> },
          { titulo: 'Previsão', valor: (o) => <span className="numeros">{o.previsaoEntrega ? formatarDataISO(o.previsaoEntrega) : '—'}</span> },
        ]}
      />

      {ordens.length >= LIMITE_LISTA && (
        <p className="text-sm text-tinta-suave">
          Mostrando as {LIMITE_LISTA} OS mais recentes. Use o filtro de etapa para achar as outras.
        </p>
      )}
    </div>
  )
}
