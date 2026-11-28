import { describe, expect, test } from 'vitest'
import { eventoDaEtapa, linkWhatsApp, numeroWhatsApp, preencherMensagem } from '@/lib/whatsapp'

describe('número do WhatsApp', () => {
  test('celular e fixo com DDD ganham o 55', () => {
    expect(numeroWhatsApp('13999990000')).toBe('5513999990000')
    expect(numeroWhatsApp('(13) 3333-4444')).toBe('551333334444')
  })
  test('já com 55 fica como está', () => {
    expect(numeroWhatsApp('+55 13 99999-0000')).toBe('5513999990000')
  })
  test('incompleto ou vazio: sem botão', () => {
    expect(numeroWhatsApp('99990000')).toBeNull()
    expect(numeroWhatsApp('')).toBeNull()
    expect(numeroWhatsApp(null)).toBeNull()
    expect(numeroWhatsApp('4413999990000')).toBeNull()
  })
})

describe('mensagem', () => {
  test('preenche as variáveis da mensagem padrão', () => {
    expect(
      preencherMensagem('Olá {cliente}! Seu {aparelho} está pronto na {loja}. {link}', {
        cliente: 'Maria',
        aparelho: 'iPhone 11',
        loja: 'Loja do Zé',
        link: 'https://x.y/acompanhar/abc',
      }),
    ).toBe('Olá Maria! Seu iPhone 11 está pronto na Loja do Zé. https://x.y/acompanhar/abc')
  })
  test('variável sem valor some, sem deixar {chave} nem espaço sobrando', () => {
    expect(preencherMensagem('Olá {cliente}! Garantia de {prazo_garantia}. {link}', { cliente: 'Maria' })).toBe(
      'Olá Maria! Garantia de.',
    )
  })
})

describe('link wa.me', () => {
  test('codifica a mensagem', () => {
    expect(linkWhatsApp('13999990000', 'Olá Maria! R$ 220,00 & tal')).toBe(
      'https://wa.me/5513999990000?text=Ol%C3%A1%20Maria!%20R%24%20220%2C00%20%26%20tal',
    )
  })
  test('sem número válido não há link', () => {
    expect(linkWhatsApp('123', 'oi')).toBeNull()
  })
})

describe('aviso da etapa', () => {
  test('cada etapa com aviso aponta o evento certo', () => {
    expect(eventoDaEtapa('aberta')).toBe('os_aberta')
    expect(eventoDaEtapa('orcamento_enviado')).toBe('orcamento_enviado')
    expect(eventoDaEtapa('aguardando_peca')).toBe('aguardando_peca')
    expect(eventoDaEtapa('pronto')).toBe('pronto')
    expect(eventoDaEtapa('entregue')).toBe('entregue')
    expect(eventoDaEtapa('devolvido')).toBe('devolvido')
  })
  test('etapas internas não sugerem aviso', () => {
    expect(eventoDaEtapa('em_servico')).toBeNull()
    expect(eventoDaEtapa('aprovado')).toBeNull()
  })
})
