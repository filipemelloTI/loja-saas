'use server'

import { listarClientes } from './dados'
import { resumir, type ClienteResumo } from './resumo'

/**
 * Busca da lista. É uma ação (e não um `?q=` na URL) porque o termo pode ser um CPF, e CPF
 * nunca vai para URL, histórico do navegador nem log de acesso.
 */
export async function buscarClientes(termo: string): Promise<ClienteResumo[]> {
  const { clientes } = await listarClientes(String(termo).slice(0, 100))
  return clientes.map(resumir)
}
