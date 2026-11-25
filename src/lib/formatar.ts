/**
 * Formatação para a tela. Telefone e CPF são guardados só com dígitos (ver `lib/clientes.ts`);
 * aqui eles ganham a máscara. Valor fora do padrão volta como veio, nunca quebra a tela.
 */
const soDigitos = (v: string) => v.replace(/\D/g, '')

/** `13999999999` → `(13) 99999-9999`; fixo de 10 dígitos → `(13) 3333-4444`. */
export function formatarTelefone(valor: string): string {
  const d = soDigitos(valor)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return valor
}

/** `52998224725` → `529.982.247-25`. */
export function formatarCpf(valor: string): string {
  const d = soDigitos(valor)
  if (d.length !== 11) return valor
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Data pura (`2000-05-17`) → `17/05/2000`, sem passar por fuso horário. */
export function formatarDataISO(valor: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor
}

const dataDaLoja = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })

/** Instante gravado no banco (`criado_em`) → `17/05/2026`, no horário de Brasília. */
export function formatarData(instante: string): string {
  const d = new Date(instante)
  return Number.isNaN(d.getTime()) ? instante : dataDaLoja.format(d)
}
