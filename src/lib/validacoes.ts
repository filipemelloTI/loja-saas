import { z } from 'zod'
import { validarModulos } from './permissoes'
import type { Modulo } from './tipos'

const diasInteiro = z.number({ message: 'Informe um número' }).int('Use um número inteiro').min(0, 'Não pode ser negativo')
const inicial = z.number({ message: 'Informe um número' }).int('Use um número inteiro').min(1, 'Deve ser no mínimo 1')
const dinheiro = z.number({ message: 'Informe um valor' }).min(0, 'Não pode ser negativo')
const email = z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido')

/** Campo opcional de formulário: vazio ou só espaços vira `undefined`, antes de validar. */
const opcional = <T extends z.ZodType>(esquema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), esquema.optional())
const textoOpcional = opcional(z.string().trim())

export const esquemaServico = z.object({
  nome: z.string().trim().min(1, 'Informe o nome').max(80, 'Máximo de 80 caracteres'),
  preco: dinheiro,
  custo: dinheiro,
  garantiaDias: diasInteiro.optional(),
})

const perfil = z.enum(['dono', 'tecnico', 'atendente'], { message: 'Perfil inválido' })
const comissao = z.number({ message: 'Informe um número' }).min(0, 'Mínimo 0%').max(100, 'Máximo 100%')
const SEM_COMISSAO_ATENDENTE = { message: 'Comissão não vale para atendente', path: ['comissao'] }

export const esquemaMembro = z
  .object({
    nome: z.string().trim().min(1, 'Informe o nome'),
    email,
    perfil,
    comissao: comissao.optional(),
  })
  .refine((m) => m.comissao === undefined || m.perfil === 'tecnico' || m.perfil === 'dono', SEM_COMISSAO_ATENDENTE)

/** Edição de um membro já cadastrado: `comissao: null` remove a comissão. */
export const esquemaEdicaoMembro = z
  .object({ perfil, ativo: z.boolean(), comissao: comissao.nullable() })
  .refine((m) => m.comissao === null || m.perfil !== 'atendente', SEM_COMISSAO_ATENDENTE)

export const esquemaConfigLoja = z.object({
  cnpj: z.string().optional(),
  endereco: z.string().optional(),
  telefone: z.string().optional(),
  textoTermos: z.string().optional(),
  garantiaServicoDias: diasInteiro,
  garantiaNovoDias: diasInteiro,
  garantiaSeminovoDias: diasInteiro,
  garantiaAcessorioDias: diasInteiro,
  orcamentoAlertaDias: diasInteiro,
  taxaAvaliacaoAtiva: z.boolean(),
  taxaAvaliacaoValor: dinheiro,
  osNumeroInicial: inicial,
  vendaNumeroInicial: inicial,
  formasPagamento: z.array(z.string()),
  donoGeraComissao: z.boolean(),
  tecnicoVePropriaComissao: z.boolean(),
})

export const esquemaNovaLoja = z
  .object({
    nomeLoja: z.string().trim().min(1, 'Informe o nome da loja'),
    nomeDono: z.string().trim().min(1, 'Informe o nome do dono'),
    emailDono: email,
    planoId: z.string().min(1, 'Escolha um plano'),
    modulos: z.array(z.enum(['servico', 'estoque', 'vendas', 'fornecedores', 'financeiro'])),
  })
  .superRefine((v, ctx) => {
    const r = validarModulos(v.modulos as Modulo[])
    if (!r.ok) ctx.addIssue({ code: 'custom', message: r.erro, path: ['modulos'] })
  })

/** Confere os dois dígitos verificadores; aceita com ou sem máscara. */
export function cpfValido(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const digito = (n: number) => {
    let soma = 0
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

export const esquemaCliente = z.object({
  nome: z.string().trim().min(1, 'Informe o nome'),
  telefone: z.string().trim().min(1, 'Informe o telefone'),
  cpf: opcional(z.string().refine(cpfValido, 'CPF inválido')),
  email: opcional(email),
  endereco: textoOpcional,
  nascimento: opcional(z.iso.date('Data inválida')),
})

/** Mesmos valores do enum `public.tipo_aparelho` no banco (`relogio` sem acento). */
const aparelhoTipo = z.enum(['celular', 'tablet', 'relogio', 'notebook', 'outro'], { message: 'Escolha o tipo do aparelho' })

export const esquemaNovaOS = z
  .object({
    interna: z.boolean(),
    clienteId: z.string().trim().optional(),
    aparelhoTipo,
    marca: textoOpcional,
    modelo: textoOpcional,
    cor: textoOpcional,
    imei: textoOpcional,
    defeitoRelatado: z.string().trim().min(1, 'Descreva o defeito'),
    acessorios: z.array(z.string()).optional(),
    checklist: z
      .array(z.object({ nome: z.string().trim().min(1, 'Informe o nome do item'), marcado: z.boolean(), observacao: textoOpcional }))
      .optional(),
    observacao: textoOpcional,
    tecnicoId: opcional(z.string().trim()),
    previsaoEntrega: opcional(z.iso.date('Data inválida')),
    senhaAparelho: opcional(z.string()),
  })
  .superRefine((v, ctx) => {
    const temCliente = !!v.clienteId
    if (!v.interna && !temCliente) ctx.addIssue({ code: 'custom', message: 'Escolha o cliente', path: ['clienteId'] })
    if (v.interna && temCliente) ctx.addIssue({ code: 'custom', message: 'OS interna não tem cliente', path: ['clienteId'] })
  })

export const esquemaLaudo = z.object({
  laudo: z.string().trim().min(1, 'Escreva o laudo'),
})

export const esquemaItemOrcamento = z.object({
  descricao: z.string().trim().min(1, 'Descreva o item').max(120, 'Máximo de 120 caracteres'),
  quantidade: z.number({ message: 'Informe a quantidade' }).int('Use um número inteiro').min(1, 'Mínimo 1').max(999, 'Máximo 999'),
  precoUnitario: dinheiro,
  servicoId: opcional(z.string().uuid('Serviço inválido')),
})

export const esquemaPeca = z.object({
  descricao: z.string().trim().min(1, 'Descreva a peça').max(120, 'Máximo de 120 caracteres'),
  quantidade: z.number({ message: 'Informe a quantidade' }).int('Use um número inteiro').min(1, 'Mínimo 1').max(999, 'Máximo 999'),
  precoUnitario: dinheiro,
})

export const esquemaCustoPeca = z.object({ custoUnitario: dinheiro })

export const esquemaDesconto = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('nenhum') }),
  z.object({ tipo: z.literal('valor'), valor: dinheiro }),
  z.object({
    tipo: z.literal('percentual'),
    valor: z.number({ message: 'Informe um número' }).min(0, 'Mínimo 0%').max(100, 'Máximo 100%'),
  }),
])

export const MEIOS_APROVACAO = ['balcao', 'telefone', 'whatsapp', 'outro'] as const

export const esquemaAprovacao = z.object({
  por: z.string().trim().min(1, 'Informe quem aprovou').max(80, 'Máximo de 80 caracteres'),
  meio: z.enum(MEIOS_APROVACAO, { message: 'Informe como o cliente aprovou' }),
})
