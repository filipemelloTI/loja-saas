'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { CaixaLink } from '@/components/CaixaLink'
import { Alerta, Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Cartao } from '@/components/ui/Cartao'
import { Selo } from '@/components/ui/Selo'
import { TabelaResponsiva } from '@/components/ui/TabelaResponsiva'
import { ROTULO_PERFIL } from '@/lib/rotulos'
import type { Perfil } from '@/lib/tipos'
import { adicionarUsuario, atualizarUsuario, gerarLinkSenha } from '../acoes'
import { CLASSE_SELECAO, Marcar, type Msg } from './comum'

export type Usuario = { id: string; nome: string; perfil: Perfil; ativo: boolean; comissao: number | null }

const PERFIS: Perfil[] = ['tecnico', 'atendente', 'dono']
const temComissao = (p: Perfil) => p !== 'atendente'
const formatarPct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const lerPct = (t: string) => (t.trim() === '' ? null : Number(t.replace(',', '.')))

type Props = { usuarios: Usuario[]; limite: number | null; somenteLeitura: boolean }

export function GerenciarUsuarios({ usuarios, limite, somenteLeitura }: Props) {
  const [editando, setEditando] = useState<string | null>(null)
  const ativos = usuarios.filter((u) => u.ativo).length
  const emEdicao = usuarios.find((u) => u.id === editando)

  return (
    <>
      {limite !== null && (
        <p className="text-tinta">
          <span className="numeros font-semibold">
            {ativos} de {limite}
          </span>{' '}
          usuários do plano <span className="text-tinta-suave">(contam só os ativos)</span>
        </p>
      )}

      <TabelaResponsiva
        legenda="Usuários da loja"
        linhas={usuarios}
        chave={(u) => u.id}
        vazio="Nenhum usuário ainda."
        colunas={[
          { titulo: 'Nome', valor: (u) => u.nome },
          { titulo: 'Perfil', valor: (u) => ROTULO_PERFIL[u.perfil] },
          { titulo: 'Comissão', valor: (u) => (u.comissao === null ? '—' : formatarPct(u.comissao)), alinhar: 'direita' },
          { titulo: 'Situação', valor: (u) => (u.ativo ? <Selo tom="info">Ativo</Selo> : <Selo>Desativado</Selo>) },
          {
            titulo: 'Ações',
            valor: (u) => (
              <Botao variante="discreto" className="-my-2" onClick={() => setEditando(u.id)} aria-label={`Editar ${u.nome}`}>
                Editar
              </Botao>
            ),
          },
        ]}
      />

      {emEdicao && (
        <Cartao titulo={`Editar ${emEdicao.nome}`}>
          <EditarUsuario key={emEdicao.id} usuario={emEdicao} somenteLeitura={somenteLeitura} aoFechar={() => setEditando(null)} />
        </Cartao>
      )}

      <Cartao titulo="Adicionar usuário">
        <NovoUsuario somenteLeitura={somenteLeitura} />
      </Cartao>
    </>
  )
}

function SeletorPerfil({ id, valor, aoMudar }: { id: string; valor: Perfil; aoMudar: (p: Perfil) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-tinta">
        Perfil
      </label>
      <select id={id} name="perfil" value={valor} onChange={(e) => aoMudar(e.target.value as Perfil)} className={CLASSE_SELECAO}>
        {PERFIS.map((p) => (
          <option key={p} value={p}>
            {ROTULO_PERFIL[p]}
          </option>
        ))}
      </select>
    </div>
  )
}

function CampoComissao({ id, valor, aoMudar }: { id: string; valor: string; aoMudar: (v: string) => void }) {
  return (
    <Campo
      id={id}
      name="comissao"
      rotulo="Comissão (%)"
      inputMode="decimal"
      dica="Deixe em branco se não ganha comissão."
      value={valor}
      onChange={(e) => aoMudar(e.target.value)}
    />
  )
}

function NovoUsuario({ somenteLeitura }: { somenteLeitura: boolean }) {
  const [perfil, setPerfil] = useState<Perfil>('tecnico')
  const [comissao, setComissao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [criado, setCriado] = useState<{ nome: string; link: string } | null>(null)
  const [pendente, iniciar] = useTransition()

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    const formulario = e.currentTarget
    const form = new FormData(formulario)
    if (!temComissao(perfil)) form.delete('comissao')
    iniciar(async () => {
      const r = await adicionarUsuario(form)
      if (!r.ok) return setErro(r.erro)
      setCriado({ nome: String(form.get('nome')), link: r.linkDefinirSenha })
      formulario.reset()
      setPerfil('tecnico')
      setComissao('')
    })
  }

  if (criado) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="font-semibold text-tinta">
          {criado.nome} foi cadastrado.
        </p>
        <CaixaLink link={criado.link} para={criado.nome} />
        <div>
          <Botao variante="secundario" onClick={() => setCriado(null)}>
            Adicionar outro
          </Botao>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={enviar}>
      <fieldset disabled={somenteLeitura} className="flex flex-col gap-4">
        <legend className="sr-only">Novo usuário</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="novo-nome" name="nome" rotulo="Nome" required autoComplete="off" />
          <Campo id="novo-email" name="email" rotulo="E-mail" type="email" inputMode="email" required autoComplete="off" />
          <SeletorPerfil id="novo-perfil" valor={perfil} aoMudar={setPerfil} />
          {temComissao(perfil) && <CampoComissao id="novo-comissao" valor={comissao} aoMudar={setComissao} />}
        </div>
        {erro && <Alerta>{erro}</Alerta>}
        <div>
          <Botao type="submit" carregando={pendente} rotuloCarregando="Cadastrando…">
            Cadastrar usuário
          </Botao>
        </div>
      </fieldset>
    </form>
  )
}

function EditarUsuario({ usuario, somenteLeitura, aoFechar }: { usuario: Usuario; somenteLeitura: boolean; aoFechar: () => void }) {
  const [perfil, setPerfil] = useState(usuario.perfil)
  const [ativo, setAtivo] = useState(usuario.ativo)
  const [comissao, setComissao] = useState(usuario.comissao === null ? '' : String(usuario.comissao).replace('.', ','))
  const [msg, setMsg] = useState<Msg>(null)
  const [link, setLink] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    iniciar(async () => {
      const r = await atualizarUsuario(usuario.id, { perfil, ativo, comissao: temComissao(perfil) ? lerPct(comissao) : null })
      setMsg(r.ok ? { ok: true, texto: 'Alterações salvas.' } : { ok: false, texto: r.erro })
    })
  }

  function novoLink() {
    setMsg(null)
    iniciar(async () => {
      const r = await gerarLinkSenha(usuario.id)
      if (r.ok) setLink(r.linkDefinirSenha)
      else setMsg({ ok: false, texto: r.erro })
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={salvar}>
        <fieldset disabled={somenteLeitura} className="flex flex-col gap-4">
          <legend className="sr-only">Perfil, comissão e acesso de {usuario.nome}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <SeletorPerfil id="editar-perfil" valor={perfil} aoMudar={setPerfil} />
            {temComissao(perfil) && <CampoComissao id="editar-comissao" valor={comissao} aoMudar={setComissao} />}
          </div>
          <Marcar
            rotulo="Ativo"
            dica="Desativado não entra no sistema e não conta no limite do plano."
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
          <Retorno msg={msg} />
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" carregando={pendente} rotuloCarregando="Salvando…">
              Salvar alterações
            </Botao>
            <Botao variante="discreto" onClick={aoFechar}>
              Fechar
            </Botao>
          </div>
        </fieldset>
      </form>

      <div className="flex flex-col gap-3 border-t border-linha pt-4">
        <p className="max-w-prose text-sm text-tinta-suave">
          Esqueceu a senha ou o primeiro link venceu? Gere um novo e mande pelo WhatsApp. O anterior deixa de valer.
        </p>
        {link ? (
          <CaixaLink link={link} para={usuario.nome} />
        ) : (
          <div>
            <Botao variante="secundario" onClick={novoLink} disabled={pendente || somenteLeitura}>
              Gerar link de senha
            </Botao>
          </div>
        )}
      </div>
    </div>
  )
}
