'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, useTransition, type FormEvent, type KeyboardEvent } from 'react'
import { Alerta, Retorno } from '@/components/ui/Avisos'
import { Botao } from '@/components/ui/Botao'
import { Campo, Rotulo } from '@/components/ui/Campo'
import { formatarTelefone } from '@/lib/formatar'
import { ROTULO_APARELHO } from '@/lib/rotulos'
import { buscarClientes } from '../../clientes/buscar'
import type { ClienteResumo } from '../../clientes/resumo'
import { abrirOS, salvarLaudo } from '../acoes'
import type { ItemChecklist, Tecnico } from '../dados'

type Msg = { ok: boolean; texto: string } | null

/** Mesma aparência do `Campo`, para `select` e `textarea` (o `Rotulo` casa o rótulo). */
const CAIXA = 'min-h-11 w-full rounded-lg border border-linha-forte bg-superficie px-3 text-base text-tinta disabled:bg-superficie-2'

const NAO_ABRIU = 'Não foi possível abrir a OS agora. Confira a lista de OS antes de tentar de novo, para não abrir duas.'

/**
 * Abertura de OS. Quase tudo é opcional, então (DESIGN.md §6.2) marca-se o obrigatório com `*`.
 * O formulário não é controlado: se a conexão cair, o que foi digitado continua na tela.
 */
export function FormularioOS({
  itensChecklist,
  tecnicos,
  somenteLeitura,
}: {
  itensChecklist: ItemChecklist[]
  tecnicos: Tecnico[]
  somenteLeitura: boolean
}) {
  const router = useRouter()
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()
  const [navegando, setNavegando] = useState(false)
  const [interna, setInterna] = useState(false)
  const [cliente, setCliente] = useState<ClienteResumo | null>(null)

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    const dados = new FormData(e.currentTarget)
    const texto = (nome: string) => String(dados.get(nome) ?? '')
    iniciar(async () => {
      try {
        const r = await abrirOS({
          interna,
          clienteId: interna ? undefined : cliente?.id,
          aparelhoTipo: texto('aparelhoTipo') as 'celular',
          marca: texto('marca'),
          modelo: texto('modelo'),
          cor: texto('cor'),
          imei: texto('imei'),
          defeitoRelatado: texto('defeitoRelatado'),
          acessorios: texto('acessorios')
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
          checklist: itensChecklist.map((item, i) => ({
            nome: item.nome,
            marcado: dados.get(`marcado-${i}`) === 'on',
            observacao: texto(`obs-${i}`),
          })),
          observacao: texto('observacao'),
          tecnicoId: texto('tecnicoId'),
          previsaoEntrega: texto('previsaoEntrega'),
          senhaAparelho: texto('senhaAparelho'),
        })
        if (!r.ok) return setMsg({ ok: false, texto: r.erro })
        setNavegando(true)
        router.push(`/servico/${r.id}`)
      } catch {
        setMsg({ ok: false, texto: NAO_ABRIU })
      }
    })
  }

  return (
    <form onSubmit={enviar} onChange={() => setMsg(null)}>
      <fieldset disabled={somenteLeitura} className="flex flex-col gap-6">
        <legend className="sr-only">Nova ordem de serviço</legend>

        <SecaoCliente interna={interna} setInterna={setInterna} cliente={cliente} setCliente={setCliente} />

        <section aria-labelledby="sec-aparelho" className="flex flex-col gap-4">
          <h2 id="sec-aparelho" className="font-titulo text-lg font-semibold text-tinta">
            Aparelho
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Rotulo htmlFor="os-tipo" obrigatorio>
                Tipo
              </Rotulo>
              <select id="os-tipo" name="aparelhoTipo" required defaultValue="celular" className={CAIXA}>
                {Object.entries(ROTULO_APARELHO).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </div>
            <Campo id="os-marca" name="marca" rotulo="Marca" autoComplete="off" />
            <Campo id="os-modelo" name="modelo" rotulo="Modelo" autoComplete="off" />
            <Campo id="os-cor" name="cor" rotulo="Cor" autoComplete="off" />
            <Campo id="os-imei" name="imei" rotulo="IMEI" inputMode="numeric" autoComplete="off" />
            <Campo
              id="os-acessorios"
              name="acessorios"
              rotulo="Acessórios deixados"
              autoComplete="off"
              placeholder="Capa, carregador, chip"
              dica="Separe com vírgula."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Rotulo htmlFor="os-defeito" obrigatorio>
              Defeito relatado
            </Rotulo>
            <textarea id="os-defeito" name="defeitoRelatado" required rows={3} className={`${CAIXA} py-2`} />
          </div>
        </section>

        {itensChecklist.length > 0 && (
          <section aria-labelledby="sec-checklist" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 id="sec-checklist" className="font-titulo text-lg font-semibold text-tinta">
                Estado do aparelho
              </h2>
              <p className="text-sm text-tinta-suave">
                Marque o que o aparelho apresenta ao chegar e anote o detalhe, se precisar. Fica registrado na OS.
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {itensChecklist.map((item, i) => (
                <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-linha p-3 sm:flex-row sm:items-center">
                  <label className="flex min-h-11 flex-1 items-center gap-3 text-base text-tinta">
                    <input type="checkbox" name={`marcado-${i}`} className="size-5 shrink-0 accent-marca" />
                    {item.nome}
                  </label>
                  <input
                    type="text"
                    name={`obs-${i}`}
                    aria-label={`Observação sobre: ${item.nome}`}
                    placeholder="Observação"
                    autoComplete="off"
                    className={`${CAIXA} placeholder:text-tinta-suave sm:max-w-xs`}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="sec-conserto" className="flex flex-col gap-4">
          <h2 id="sec-conserto" className="font-titulo text-lg font-semibold text-tinta">
            Conserto
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Rotulo htmlFor="os-tecnico">Técnico</Rotulo>
              <select id="os-tecnico" name="tecnicoId" defaultValue="" className={CAIXA}>
                <option value="">Definir depois</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
            <Campo id="os-previsao" name="previsaoEntrega" rotulo="Previsão de entrega" type="date" />
            <Campo
              id="os-senha"
              name="senhaAparelho"
              rotulo="Senha do aparelho"
              type="password"
              autoComplete="new-password"
              dica="Fica guardada e só o Dono e o técnico conseguem ver, na tela da OS. Se for desenho, descreva na observação."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Rotulo htmlFor="os-observacao">Observação</Rotulo>
            <textarea id="os-observacao" name="observacao" rows={2} className={`${CAIXA} py-2`} />
          </div>
        </section>

        <Retorno msg={msg} />
        <div>
          <Botao type="submit" carregando={pendente || navegando} rotuloCarregando="Abrindo OS…">
            Abrir OS
          </Botao>
        </div>
      </fieldset>
    </form>
  )
}

/** Cliente da OS: busca pelo servidor (o termo pode ser CPF, então nunca vai para a URL) ou OS interna. */
function SecaoCliente({
  interna,
  setInterna,
  cliente,
  setCliente,
}: {
  interna: boolean
  setInterna: (v: boolean) => void
  cliente: ClienteResumo | null
  setCliente: (c: ClienteResumo | null) => void
}) {
  const grupo = useId()
  const [termo, setTermo] = useState('')
  const [achados, setAchados] = useState<ClienteResumo[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  function buscar() {
    if (!termo.trim()) return
    setErro(null)
    iniciar(async () => {
      try {
        setAchados(await buscarClientes(termo))
      } catch {
        setErro('Não foi possível buscar agora. Tente de novo.')
      }
    })
  }

  // Enter busca em vez de enviar o formulário inteiro (a busca não é um <form> aninhado).
  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      buscar()
    }
  }

  return (
    <section aria-labelledby="sec-cliente" className="flex flex-col gap-4">
      <h2 id="sec-cliente" className="font-titulo text-lg font-semibold text-tinta">
        Cliente
      </h2>
      <div role="radiogroup" aria-labelledby="sec-cliente" className="flex flex-col gap-1 sm:flex-row sm:gap-6">
        {[
          { valor: false, rotulo: 'De um cliente' },
          { valor: true, rotulo: 'OS interna, sem cliente' },
        ].map((op) => (
          <label key={String(op.valor)} className="flex min-h-11 items-center gap-3 text-base text-tinta">
            <input
              type="radio"
              name={grupo}
              checked={interna === op.valor}
              onChange={() => setInterna(op.valor)}
              className="size-5 accent-marca"
            />
            {op.rotulo}
          </label>
        ))}
      </div>

      {!interna && (
        <div className="flex flex-col gap-3">
          {cliente ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-marca bg-marca-suave px-3 py-2">
              <p className="min-w-0 text-marca-forte">
                <span className="font-semibold">{cliente.nome}</span>{' '}
                <span className="numeros">{formatarTelefone(cliente.telefone)}</span>
              </p>
              <Botao variante="secundario" onClick={() => setCliente(null)}>
                Trocar cliente
              </Botao>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-2">
                <Campo
                  className="min-w-0 flex-1"
                  id="os-busca-cliente"
                  name="buscaCliente"
                  rotulo="Buscar cliente"
                  marcarObrigatorio
                  type="search"
                  placeholder="Nome, telefone, CPF ou IMEI"
                  autoComplete="off"
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  onKeyDown={aoTeclar}
                />
                <Botao variante="secundario" onClick={buscar} carregando={pendente} rotuloCarregando="Buscando…">
                  Buscar
                </Botao>
              </div>
              {erro && <Alerta>{erro}</Alerta>}
              {achados && achados.length === 0 && (
                <p className="rounded-lg border border-dashed border-linha-forte p-4 text-tinta-suave">
                  Nenhum cliente encontrado. Confira o nome, o telefone ou o CPF, ou cadastre o cliente em Clientes e volte aqui.
                </p>
              )}
              {achados && achados.length > 0 && (
                <ul aria-label="Clientes encontrados" className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                  {achados.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setCliente(c)
                          setAchados(null)
                          setTermo('')
                        }}
                        className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-4 rounded-lg border border-linha px-3 py-2 text-left hover:bg-superficie-2"
                      >
                        <span className="font-semibold text-tinta">{c.nome}</span>
                        <span className="numeros text-tinta-suave">{formatarTelefone(c.telefone)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

/** Laudo do técnico: texto livre, salvo à parte para não depender de mudar a etapa. */
export function FormularioLaudo({ osId, laudo, somenteLeitura }: { osId: string; laudo: string | null; somenteLeitura: boolean }) {
  const [msg, setMsg] = useState<Msg>(null)
  const [pendente, iniciar] = useTransition()

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMsg(null)
    const texto = String(new FormData(e.currentTarget).get('laudo') ?? '')
    iniciar(async () => {
      try {
        const r = await salvarLaudo(osId, texto)
        setMsg(r.ok ? { ok: true, texto: 'Laudo salvo.' } : { ok: false, texto: r.erro })
      } catch {
        // Conexão caiu no meio: o texto continua na caixa para tentar de novo.
        setMsg({ ok: false, texto: 'Não foi possível salvar agora. Tente de novo.' })
      }
    })
  }

  return (
    <form onSubmit={enviar} onChange={() => setMsg(null)}>
      <fieldset disabled={somenteLeitura} className="flex flex-col gap-3">
        <legend className="sr-only">Laudo da OS</legend>
        <div className="flex flex-col gap-1.5">
          <Rotulo htmlFor="os-laudo">Laudo do técnico</Rotulo>
          <textarea id="os-laudo" name="laudo" rows={5} defaultValue={laudo ?? ''} className={`${CAIXA} py-2`} />
        </div>
        <Retorno msg={msg} />
        <div>
          <Botao type="submit" carregando={pendente} rotuloCarregando="Salvando…">
            Salvar laudo
          </Botao>
        </div>
      </fieldset>
    </form>
  )
}
