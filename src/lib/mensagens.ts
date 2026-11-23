/** Eventos que disparam mensagem no WhatsApp, na ordem em que aparecem na tela. */
export const EVENTOS = [
  'os_aberta',
  'orcamento_enviado',
  'aguardando_peca',
  'pronto',
  'entregue',
  'devolvido',
  'venda_concluida',
] as const

export type Evento = (typeof EVENTOS)[number]

export const ROTULO_EVENTO: Record<Evento, string> = {
  os_aberta: 'OS aberta',
  orcamento_enviado: 'Orçamento enviado',
  aguardando_peca: 'Aguardando peça',
  pronto: 'Pronto para retirada',
  entregue: 'Entregue',
  devolvido: 'Devolvido sem conserto',
  venda_concluida: 'Venda concluída',
}

/** Variáveis que o sistema preenche em cada evento. */
export const VARIAVEIS_EVENTO: Record<Evento, string[]> = {
  os_aberta: ['cliente', 'aparelho', 'loja', 'numero_os', 'link'],
  orcamento_enviado: ['cliente', 'aparelho', 'loja', 'numero_os', 'valor', 'link'],
  aguardando_peca: ['cliente', 'aparelho', 'loja', 'numero_os', 'link'],
  pronto: ['cliente', 'aparelho', 'loja', 'numero_os', 'link'],
  entregue: ['cliente', 'aparelho', 'loja', 'numero_os', 'servico', 'prazo_garantia', 'link'],
  devolvido: ['cliente', 'aparelho', 'loja', 'numero_os'],
  venda_concluida: ['cliente', 'aparelho', 'loja', 'prazo_garantia', 'link'],
}

/**
 * Textos padrão. Iguais aos semeados em `semear_loja()`
 * (supabase/migrations/20261122000003_configuracoes.sql): mudou lá, mude aqui.
 */
export const MENSAGEM_PADRAO: Record<Evento, string> = {
  os_aberta: 'Olá {cliente}! Recebemos seu {aparelho} na {loja}. OS nº {numero_os}. Acompanhe por aqui: {link}',
  orcamento_enviado: 'Olá {cliente}! O orçamento do seu {aparelho} ficou em {valor}. Para aprovar ou recusar: {link}',
  aguardando_peca: 'Olá {cliente}! Estamos aguardando a peça para o reparo do seu {aparelho}. Avisaremos assim que chegar. {link}',
  pronto: 'Olá {cliente}! Seu {aparelho} está pronto para retirada na {loja}. {link}',
  entregue: 'Obrigado, {cliente}! Seu {aparelho} foi entregue com garantia de {prazo_garantia} para {servico}. Termo e detalhes: {link}',
  devolvido: 'Olá {cliente}! Seu {aparelho} foi devolvido. Qualquer dúvida, fale com a {loja}.',
  venda_concluida: 'Obrigado pela compra, {cliente}! Seu {aparelho} tem garantia de {prazo_garantia}. Detalhes: {link}',
}

export function eventoValido(evento: string): evento is Evento {
  return (EVENTOS as readonly string[]).includes(evento)
}
