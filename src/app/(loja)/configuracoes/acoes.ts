'use server'

import { refresh } from 'next/cache'
import {
  adicionarUsuarioCom,
  alternarServicoCom,
  atualizarUsuarioCom,
  enviarLogoCom,
  gerarLinkSenhaCom,
  restaurarMensagemPadraoCom,
  salvarChecklistCom,
  salvarCondicoesCom,
  salvarConfigVendasOSCom,
  salvarDadosLojaCom,
  salvarGarantiaCom,
  salvarMensagemCom,
  salvarServicoCom,
  type Condicao,
  type DadosGarantia,
  type DadosLoja,
  type DadosServico,
  type DadosVendasOS,
  type Dependencias,
  type EdicaoUsuario,
  type ItemChecklist,
} from '@/lib/configuracoes'
import { origemDoSite } from '@/lib/origem'
import { criarClienteAdmin } from '@/lib/supabase/admin'
import { criarClienteServidor } from '@/lib/supabase/servidor'

/**
 * Dono conferido no servidor pela sessão, nunca por dado vindo do cliente: membro
 * ativo com perfil dono. O admin em suporte não é membro, então nunca passa; loja
 * suspensa também não (a RLS esconde o membro).
 */
async function dependencias(): Promise<Dependencias> {
  const supabase = await criarClienteServidor()
  return {
    donoDaSessao: async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return null
      const { data } = await supabase
        .from('membros')
        .select('loja_id')
        .eq('user_id', auth.user.id)
        .eq('ativo', true)
        .eq('perfil', 'dono')
        .maybeSingle()
      return data ? { lojaId: data.loja_id as string } : null
    },
    supabase,
    admin: criarClienteAdmin(),
    origem: origemDoSite,
  }
}

/** Re-renderiza a página quando deu certo. */
function atualizarTela<T extends { ok: boolean }>(r: T): T {
  if (r.ok) refresh()
  return r
}

export async function salvarDadosLoja(dados: DadosLoja) {
  return atualizarTela(await salvarDadosLojaCom(await dependencias(), dados))
}

export async function enviarLogo(form: FormData) {
  return atualizarTela(await enviarLogoCom(await dependencias(), form))
}

export async function adicionarUsuario(form: FormData) {
  return atualizarTela(await adicionarUsuarioCom(await dependencias(), form))
}

export async function atualizarUsuario(id: string, dados: EdicaoUsuario) {
  return atualizarTela(await atualizarUsuarioCom(await dependencias(), id, dados))
}

export async function gerarLinkSenha(membroId: string) {
  return gerarLinkSenhaCom(await dependencias(), membroId)
}

export async function salvarServico(dados: DadosServico) {
  return atualizarTela(await salvarServicoCom(await dependencias(), dados))
}

export async function alternarServico(id: string, ativo: boolean) {
  return atualizarTela(await alternarServicoCom(await dependencias(), id, ativo))
}

export async function salvarMensagem(evento: string, texto: string) {
  return atualizarTela(await salvarMensagemCom(await dependencias(), evento, texto))
}

export async function restaurarMensagemPadrao(evento: string) {
  return atualizarTela(await restaurarMensagemPadraoCom(await dependencias(), evento))
}

export async function salvarGarantia(dados: DadosGarantia) {
  return atualizarTela(await salvarGarantiaCom(await dependencias(), dados))
}

export async function salvarCondicoes(lista: Condicao[]) {
  return atualizarTela(await salvarCondicoesCom(await dependencias(), lista))
}

export async function salvarChecklist(lista: ItemChecklist[]) {
  return atualizarTela(await salvarChecklistCom(await dependencias(), lista))
}

export async function salvarConfigVendasOS(dados: DadosVendasOS) {
  return atualizarTela(await salvarConfigVendasOSCom(await dependencias(), dados))
}
