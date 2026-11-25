import { DESCRICAO_SISTEMA, NOME_SISTEMA } from '@/lib/marca'

test('nome do sistema definido', () => {
  expect(NOME_SISTEMA).toBe('Gestow')
})

test('descrição do sistema definida', () => {
  expect(DESCRICAO_SISTEMA.trim().length).toBeGreaterThan(0)
})
