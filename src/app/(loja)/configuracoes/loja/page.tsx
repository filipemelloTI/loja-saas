import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Cartao } from '@/components/ui/Cartao'
import { Cabecalho, Carregando } from '../_componentes/comum'
import { FormularioDadosLoja, FormularioLogo } from '../_componentes/loja'
import { carregarBase } from '../dados'

export const metadata: Metadata = { title: 'Dados da loja' }

export default function PaginaLoja() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Cabecalho titulo="Dados da loja" sobre="Aparecem na OS, no termo de garantia e nas mensagens ao cliente." />
      <Suspense fallback={<Carregando />}>
        <Conteudo />
      </Suspense>
    </div>
  )
}

async function Conteudo() {
  const { supabase, lojaId, nomeLoja, somenteLeitura } = await carregarBase()
  const { data: c } = await supabase
    .from('config_loja')
    .select('cnpj, endereco, telefone, texto_termos, logo_path')
    .eq('loja_id', lojaId)
    .maybeSingle()
  const logo = c?.logo_path
    ? ((await supabase.storage.from('logos').createSignedUrl(c.logo_path, 60 * 60)).data?.signedUrl ?? null)
    : null

  return (
    <>
      <Cartao titulo="Logo">
        <FormularioLogo logoUrl={logo} somenteLeitura={somenteLeitura} />
      </Cartao>
      <FormularioDadosLoja
        somenteLeitura={somenteLeitura}
        inicial={{
          nome: nomeLoja,
          cnpj: c?.cnpj ?? '',
          endereco: c?.endereco ?? '',
          telefone: c?.telefone ?? '',
          textoTermos: c?.texto_termos ?? '',
        }}
      />
    </>
  )
}
