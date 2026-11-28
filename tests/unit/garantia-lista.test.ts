import { describe, expect, it } from 'vitest'
import { filtrarGarantias, type ItemGarantia } from '@/lib/garantia-lista'

const base: Omit<ItemGarantia, 'id' | 'numero' | 'cliente' | 'telefone' | 'imei' | 'situacao' | 'diasRestantes'> = {
  aparelho: 'Celular',
  venceEm: '2027-01-01',
}
const itens: ItemGarantia[] = [
  { ...base, id: '1', numero: 101, cliente: 'Maria José', telefone: '13999990000', imei: '356789012345678', situacao: 'vencendo', diasRestantes: 5 },
  { ...base, id: '2', numero: 102, cliente: 'João Pedro', telefone: '13988887777', imei: null, situacao: 'vigente', diasRestantes: 60 },
]

describe('busca de garantias', () => {
  it('sem termo, tudo', () => {
    expect(filtrarGarantias(itens, '').map((g) => g.id)).toEqual(['1', '2'])
  })
  it('nome sem acento e sem caixa', () => {
    expect(filtrarGarantias(itens, 'joao').map((g) => g.id)).toEqual(['2'])
    expect(filtrarGarantias(itens, 'MARIA JOSE').map((g) => g.id)).toEqual(['1'])
  })
  it('telefone com máscara acha pelos dígitos', () => {
    expect(filtrarGarantias(itens, '(13) 98888-7777').map((g) => g.id)).toEqual(['2'])
  })
  it('parte do IMEI', () => {
    expect(filtrarGarantias(itens, '012345').map((g) => g.id)).toEqual(['1'])
  })
  it('número da OS', () => {
    expect(filtrarGarantias(itens, '102').map((g) => g.id)).toEqual(['2'])
  })
  it('só as que estão vencendo', () => {
    expect(filtrarGarantias(itens, '', true).map((g) => g.id)).toEqual(['1'])
  })
})
