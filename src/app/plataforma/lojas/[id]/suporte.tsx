import Link from 'next/link'
import { classesBotao } from '@/components/ui/Botao'
import { Selo } from '@/components/ui/Selo'

/**
 * Entrada de suporte do admin: o botão "Entrar como suporte" só aparece quando o Dono
 * liberou um acesso vigente. Ele leva à casca da loja (`/`), onde o modo suporte (somente
 * leitura, com a faixa da Task 6) é detectado pela própria sessão.
 */
export function EntrarComoSuporte({ vigente, expiraEmTexto }: { vigente: boolean; expiraEmTexto: string | null }) {
  if (!vigente) {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <Selo tom="neutro">Sem acesso</Selo>
        </div>
        <p className="text-tinta-suave">
          O Dono ainda não liberou o acesso de suporte. Peça para ele liberar em Configurações → Acesso de suporte.
        </p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Selo tom="info">Acesso liberado</Selo>
      </div>
      <p className="text-tinta-suave">
        Você entra na loja em modo somente leitura{expiraEmTexto ? `, até ${expiraEmTexto}` : ''}.
      </p>
      <div>
        <Link href="/" className={classesBotao('primario')}>
          Entrar como suporte
        </Link>
      </div>
    </div>
  )
}
