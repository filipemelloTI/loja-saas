import { sair } from '@/lib/auth-acoes'

export default function SemAcesso() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <p>Você não tem acesso a nenhuma loja. Fale com o dono da loja ou com o suporte.</p>
      <form action={sair}>
        <button type="submit" className="rounded bg-black p-2 text-white">Sair</button>
      </form>
    </main>
  )
}
