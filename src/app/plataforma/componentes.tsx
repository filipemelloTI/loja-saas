'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense, useState, useTransition, type FormEvent } from 'react'
import { CaixaLink } from '@/components/CaixaLink'
import { Alerta, Aviso } from '@/components/ui/Avisos'
import { Botao, classesBotao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Cartao } from '@/components/ui/Cartao'
import { validarModulos } from '@/lib/permissoes'
import { MODULOS, ROTULO_MODULO, SITUACAO, type Situacao } from '@/lib/rotulos'
import type { Modulo } from '@/lib/tipos'
import { atualizarLoja, criarLoja, novoLinkDono, salvarPlano } from './acoes'

export type Plano = { id: string; nome: string; modulos: Modulo[]; limite_usuarios: number }

// Navegação --------------------------------------------------------------

const LINKS = [
  { href: '/plataforma', rotulo: 'Lojas' },
  { href: '/plataforma/planos', rotulo: 'Planos' },
]

/** A rota só existe na requisição: o esqueleto (sem item ativo) vai no pré-render. */
export function NavPlataforma() {
  return (
    <Suspense fallback={<Nav rota={null} />}>
      <NavComRota />
    </Suspense>
  )
}

function NavComRota() {
  return <Nav rota={usePathname()} />
}

function Nav({ rota }: { rota: string | null }) {
  const atual = (href: string) =>
    !!rota && (href === '/plataforma' ? rota === href || rota.startsWith('/plataforma/lojas') : rota.startsWith(href))
  return (
    <nav aria-label="Painel da plataforma">
      <ul className="flex gap-1">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={atual(l.href) ? 'page' : undefined}
              className={
                'flex min-h-11 items-center rounded-lg px-3 font-semibold ' +
                (atual(l.href) ? 'bg-marca-suave text-marca-forte' : 'text-tinta-suave hover:bg-superficie-2 hover:text-tinta')
              }
            >
              {l.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// Peças dos formulários -----------------------------------------------------

const CLASSE_SELECAO =
  'min-h-11 w-full rounded-lg border border-linha-forte bg-superficie px-3 text-base text-tinta'

function SeletorPlano({
  planos,
  valor,
  aoMudar,
}: {
  planos: Plano[]
  valor: string
  aoMudar: (plano: Plano) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="campo-planoId" className="text-sm font-semibold text-tinta">
        Plano
      </label>
      <select
        id="campo-planoId"
        name="planoId"
        required
        value={valor}
        onChange={(e) => {
          const p = planos.find((x) => x.id === e.target.value)
          if (p) aoMudar(p)
        }}
        className={CLASSE_SELECAO}
      >
        {planos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome} (até {p.limite_usuarios} {p.limite_usuarios === 1 ? 'usuário' : 'usuários'})
          </option>
        ))}
      </select>
    </div>
  )
}

function EscolhaModulos({
  valor,
  aoMudar,
  dica,
}: {
  valor: Modulo[]
  aoMudar: (m: Modulo[]) => void
  dica?: string
}) {
  const regra = validarModulos(valor)
  const alternar = (m: Modulo, ligado: boolean) =>
    aoMudar(ligado ? MODULOS.filter((x) => x === m || valor.includes(x)) : valor.filter((x) => x !== m))
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold text-tinta">Módulos</legend>
      {dica && <p className="text-sm text-tinta-suave">{dica}</p>}
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {MODULOS.map((m) => (
          <label key={m} className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-superficie-2">
            <input
              type="checkbox"
              name="modulos"
              value={m}
              checked={valor.includes(m)}
              onChange={(e) => alternar(m, e.target.checked)}
              className="size-5 accent-marca"
            />
            {ROTULO_MODULO[m]}
          </label>
        ))}
      </div>
      {!regra.ok && <p className="text-sm font-medium text-perigo">{regra.erro}</p>}
    </fieldset>
  )
}

// Nova loja ----------------------------------------------------------------

export function FormularioNovaLoja({ planos }: { planos: Plano[] }) {
  const [plano, setPlano] = useState(planos[0])
  const [modulos, setModulos] = useState<Modulo[]>(planos[0].modulos)
  const [erro, setErro] = useState<string | null>(null)
  const [criada, setCriada] = useState<{ nome: string; link: string } | null>(null)
  const [pendente, iniciar] = useTransition()

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    iniciar(async () => {
      const r = await criarLoja(form)
      if (r.ok) setCriada({ nome: String(form.get('nomeLoja')), link: r.linkDefinirSenha })
      else setErro(r.erro)
    })
  }

  if (criada) {
    return (
      <Cartao titulo={`Loja “${criada.nome}” criada`}>
        <div className="flex flex-col gap-4">
          <CaixaLink link={criada.link} para="o Dono" />
          <div className="flex flex-wrap gap-2">
            <Link href="/plataforma" className={classesBotao('secundario')}>
              Ver lojas
            </Link>
          </div>
        </div>
      </Cartao>
    )
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <Cartao titulo="Loja">
        <div className="flex flex-col gap-4">
          <Campo name="nomeLoja" rotulo="Nome da loja" required autoComplete="off" />
          <SeletorPlano
            planos={planos}
            valor={plano.id}
            aoMudar={(p) => {
              setPlano(p)
              setModulos(p.modulos)
            }}
          />
          <EscolhaModulos valor={modulos} aoMudar={setModulos} dica="Já vêm marcados os módulos do plano." />
        </div>
      </Cartao>
      <Cartao titulo="Dono">
        <div className="flex flex-col gap-4">
          <Campo name="nomeDono" rotulo="Nome do Dono" required autoComplete="off" />
          <Campo name="emailDono" rotulo="E-mail do Dono" type="email" required autoComplete="off" inputMode="email" />
        </div>
      </Cartao>
      {erro && <Alerta>{erro}</Alerta>}
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" disabled={pendente || !validarModulos(modulos).ok}>
          {pendente ? 'Criando…' : 'Criar loja'}
        </Botao>
        <Link href="/plataforma" className={classesBotao('discreto')}>
          Cancelar
        </Link>
      </div>
    </form>
  )
}

// Detalhe da loja ----------------------------------------------------------

type Loja = { id: string; nome: string; plano_id: string; modulos: Modulo[]; situacao: Situacao }

export function FormularioLoja({ loja, planos }: { loja: Loja; planos: Plano[] }) {
  const [planoId, setPlanoId] = useState(loja.plano_id)
  const [modulos, setModulos] = useState<Modulo[]>(loja.modulos)
  const [situacao, setSituacao] = useState<Situacao>(loja.situacao)
  const [confirmar, setConfirmar] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendente, iniciar] = useTransition()

  function salvar() {
    setConfirmar(false)
    iniciar(async () => {
      const r = await atualizarLoja(loja.id, { planoId, modulos, situacao })
      setMsg(r.ok ? { ok: true, texto: 'Alterações salvas.' } : { ok: false, texto: r.erro })
    })
  }

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    // Suspender tira todo mundo da loja: confirma aqui na tela antes.
    if (situacao === 'suspensa' && loja.situacao !== 'suspensa') setConfirmar(true)
    else salvar()
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <Cartao titulo="Plano e módulos">
        <div className="flex flex-col gap-4">
          <SeletorPlano
            planos={planos}
            valor={planoId}
            aoMudar={(p) => {
              setPlanoId(p.id)
              setModulos(p.modulos)
            }}
          />
          <EscolhaModulos valor={modulos} aoMudar={setModulos} dica="Ao trocar o plano, os módulos dele são marcados." />
        </div>
      </Cartao>

      <Cartao titulo="Situação">
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">Situação da loja</legend>
          {(Object.keys(SITUACAO) as Situacao[]).map((s) => (
            <label key={s} className="flex min-h-11 items-center gap-3 rounded-lg px-2 hover:bg-superficie-2">
              <input
                type="radio"
                name="situacao"
                value={s}
                checked={situacao === s}
                onChange={() => {
                  setSituacao(s)
                  setConfirmar(false)
                }}
                className="size-5 accent-marca"
              />
              {SITUACAO[s].rotulo}
              {s === 'suspensa' && <span className="text-sm text-tinta-suave">— ninguém da loja consegue entrar</span>}
            </label>
          ))}
        </fieldset>
      </Cartao>

      {confirmar ? (
        <div role="alertdialog" aria-labelledby="confirmar-titulo" className="flex flex-col gap-3 rounded-xl border border-perigo bg-perigo-suave p-4">
          <p id="confirmar-titulo" className="font-semibold text-sobre-perigo-suave">
            Suspender a loja “{loja.nome}”? Todos os usuários da loja perdem o acesso até você mudar a situação de novo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao variante="perigo" onClick={salvar} disabled={pendente}>
              Sim, suspender
            </Botao>
            <Botao variante="secundario" onClick={() => setConfirmar(false)}>
              Cancelar
            </Botao>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {msg && (msg.ok ? <Aviso>{msg.texto}</Aviso> : <Alerta>{msg.texto}</Alerta>)}
          <div>
            <Botao type="submit" disabled={pendente || !validarModulos(modulos).ok}>
              {pendente ? 'Salvando…' : 'Salvar alterações'}
            </Botao>
          </div>
        </div>
      )}
    </form>
  )
}

export function LinkDono({ lojaId, dono }: { lojaId: string; dono: { nome: string; email: string } | null }) {
  const [link, setLink] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  if (!dono) return <p className="text-tinta-suave">A loja não tem Dono ativo.</p>

  function gerar() {
    setErro(null)
    iniciar(async () => {
      const r = await novoLinkDono(lojaId)
      if (r.ok) setLink(r.linkDefinirSenha)
      else setErro(r.erro)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-tinta">
        {dono.nome} <span className="text-tinta-suave">({dono.email})</span>
      </p>
      <p className="max-w-prose text-sm text-tinta-suave">
        Use quando o Dono esqueceu a senha ou o primeiro link venceu. O link anterior deixa de valer.
      </p>
      {erro && <Alerta>{erro}</Alerta>}
      {link ? (
        <CaixaLink link={link} para="o Dono" />
      ) : (
        <div>
          <Botao variante="secundario" onClick={gerar} disabled={pendente}>
            {pendente ? 'Gerando…' : 'Gerar novo link de senha'}
          </Botao>
        </div>
      )}
    </div>
  )
}

// Planos -----------------------------------------------------------------

export function FormularioPlano({ plano }: { plano?: Plano }) {
  const [nome, setNome] = useState(plano?.nome ?? '')
  const [limite, setLimite] = useState(String(plano?.limite_usuarios ?? 3))
  const [modulos, setModulos] = useState<Modulo[]>(plano?.modulos ?? ['servico'])
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [pendente, iniciar] = useTransition()
  const prefixo = plano ? `plano-${plano.id}` : 'plano-novo'

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    iniciar(async () => {
      const r = await salvarPlano({ id: plano?.id, nome, modulos, limiteUsuarios: Number(limite) })
      if (!r.ok) return setMsg({ ok: false, texto: r.erro })
      setMsg({ ok: true, texto: plano ? 'Plano salvo.' : 'Plano criado.' })
      if (!plano) {
        setNome('')
        setLimite('3')
        setModulos(['servico'])
      }
    })
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Campo id={`${prefixo}-nome`} name="nome" rotulo="Nome do plano" required value={nome} onChange={(e) => setNome(e.target.value)} />
        <Campo
          id={`${prefixo}-limite`}
          name="limiteUsuarios"
          rotulo="Limite de usuários"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          value={limite}
          onChange={(e) => setLimite(e.target.value)}
        />
      </div>
      <EscolhaModulos valor={modulos} aoMudar={setModulos} />
      {msg && (msg.ok ? <Aviso>{msg.texto}</Aviso> : <Alerta>{msg.texto}</Alerta>)}
      <div>
        <Botao type="submit" variante={plano ? 'secundario' : 'primario'} disabled={pendente || !validarModulos(modulos).ok}>
          {pendente ? 'Salvando…' : plano ? 'Salvar plano' : 'Criar plano'}
        </Botao>
      </div>
    </form>
  )
}
