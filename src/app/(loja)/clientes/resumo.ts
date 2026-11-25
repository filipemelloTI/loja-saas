/**
 * O que a lista mostra de cada cliente. O CPF fica de fora de propósito: lista de balcão não o exibe.
 * Fica fora de `buscar.ts` porque arquivo `'use server'` só pode exportar funções assíncronas.
 */
export type ClienteResumo = { id: string; nome: string; telefone: string; endereco: string | null }

/** Mesmo teto de `buscarClientesCom` (`LIMITE_BUSCA`): a lista nunca passa disso. */
export const LIMITE_LISTA = 50

export const resumir = ({ id, nome, telefone, endereco }: ClienteResumo): ClienteResumo => ({ id, nome, telefone, endereco })
