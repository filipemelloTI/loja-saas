'use server'

import { redirect } from 'next/navigation'
import { criarClienteServidor } from '@/lib/supabase/servidor'

export async function entrar(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')
  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) redirect('/login?erro=1')
  redirect('/') // o proxy leva cada perfil ao destino certo
}

export async function sair() {
  const supabase = await criarClienteServidor()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function definirSenha(formData: FormData) {
  const senha = String(formData.get('senha') ?? '')
  const confirma = String(formData.get('confirma') ?? '')
  if (senha.length < 8) redirect('/definir-senha?erro=curta')
  if (senha !== confirma) redirect('/definir-senha?erro=diferente')
  const supabase = await criarClienteServidor()
  const { error } = await supabase.auth.updateUser({ password: senha })
  if (error) redirect('/definir-senha?erro=link')
  redirect('/')
}
