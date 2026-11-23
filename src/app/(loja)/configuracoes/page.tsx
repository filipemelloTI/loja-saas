import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Configurações' }

const SECOES = [
  { href: '/configuracoes/loja', titulo: 'Dados da loja', sobre: 'Logo, nome, CNPJ, endereço, telefone e termos.' },
  { href: '/configuracoes/usuarios', titulo: 'Usuários', sobre: 'Quem usa o sistema, perfil, comissão e acesso.' },
  { href: '/configuracoes/catalogo', titulo: 'Catálogo de serviços', sobre: 'Preço, custo estimado da peça e margem.' },
  { href: '/configuracoes/mensagens', titulo: 'Mensagens do WhatsApp', sobre: 'O texto enviado ao cliente em cada etapa.' },
  { href: '/configuracoes/garantia', titulo: 'Garantia', sobre: 'Prazos e condições que anulam a garantia.' },
  { href: '/configuracoes/checklist', titulo: 'Checklist de avarias', sobre: 'Itens conferidos ao receber o aparelho.' },
  { href: '/configuracoes/vendas-e-os', titulo: 'Vendas e OS', sobre: 'Numeração, taxa de avaliação, pagamentos e comissão.' },
]

export default function PaginaConfiguracoes() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-titulo text-3xl font-bold tracking-tight">Configurações</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SECOES.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="flex h-full flex-col gap-1 rounded-xl border border-linha bg-superficie p-4 hover:border-marca hover:bg-superficie-2"
            >
              <span className="font-titulo text-lg font-semibold text-tinta">{s.titulo}</span>
              <span className="text-sm text-tinta-suave">{s.sobre}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
