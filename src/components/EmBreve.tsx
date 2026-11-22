import { Selo } from '@/components/ui/Selo'

/** Página de um módulo que ainda não foi construído. */
export function EmBreve({ titulo, sobre }: { titulo: string; sobre: string }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-titulo text-3xl font-bold tracking-tight">{titulo}</h1>
        <Selo tom="aviso">Em breve</Selo>
      </div>
      <p className="max-w-prose text-tinta-suave">{sobre}</p>
    </section>
  )
}
