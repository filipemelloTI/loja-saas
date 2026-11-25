'use server'

import { listarClientes } from './dados'

/** O que a lista mostra de cada cliente. O CPF fica de fora de propósito: lista de balcão não o exibe. */
export type ClienteResumo = { id: string; nome: string; telefone: string; endereco: string | null }

/**
 * Busca da lista. É uma ação (e não um `?q=` na URL) porque o termo pode ser um CPF, e CPF
 * nunca vai para URL, histórico do navegador nem log de acesso.
 */
export async function buscarClientes(termo: string): Promise<ClienteResumo[]> {
  const { clientes } = await listarClientes(String(termo).slice(0, 100))
  return clientes.map(({ id, nome, telefone, endereco }) => ({ id, nome, telefone, endereco }))
}
