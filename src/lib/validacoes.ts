import { z } from 'zod'
import { validarModulos } from './permissoes'
import type { Modulo } from './tipos'

const diasInteiro = z.number({ message: 'Informe um número' }).int('Use um número inteiro').min(0, 'Não pode ser negativo')
const inicial = z.number({ message: 'Informe um número' }).int('Use um número inteiro').min(1, 'Deve ser no mínimo 1')
const dinheiro = z.number({ message: 'Informe um valor' }).min(0, 'Não pode ser negativo')
const email = z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido')

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
