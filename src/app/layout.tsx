import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from 'next/font/google'
import { DESCRICAO_SISTEMA, NOME_SISTEMA } from '@/lib/marca'
import './globals.css'

const fonteTitulo = Bricolage_Grotesque({
  variable: '--fonte-titulo',
  subsets: ['latin'],
  weight: ['600', '700'],
})

const fonteTexto = Figtree({
  variable: '--fonte-texto',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

/** Terceira voz: rótulos de seção, cabeçalho de tabela, códigos. Ver `.sobrancelha`. */
const fonteMono = JetBrains_Mono({
  variable: '--fonte-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: { default: NOME_SISTEMA, template: `%s | ${NOME_SISTEMA}` },
  description: DESCRICAO_SISTEMA,
  applicationName: NOME_SISTEMA,
  appleWebApp: { capable: true, title: NOME_SISTEMA, statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icone.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icone-180.png', sizes: '180x180' }],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#151e1c' },
  ],
  viewportFit: 'cover',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      className={`${fonteTitulo.variable} ${fonteTexto.variable} ${fonteMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
