import type { MetadataRoute } from 'next'
import { NOME_SISTEMA } from '@/lib/marca'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: NOME_SISTEMA,
    short_name: NOME_SISTEMA,
    description: 'Ordens de serviço, estoque e vendas da sua loja de celular.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f3f5f4',
    theme_color: '#0d6b5f',
    icons: [
      { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
