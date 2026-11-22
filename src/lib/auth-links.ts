/** Link de definir senha: `hashedToken` é `properties.hashed_token` de `auth.admin.generateLink({type:'recovery'})`. */
export function montarLinkDefinirSenha(origem: string, hashedToken: string): string {
  const base = origem.replace(/\/+$/, '')
  return `${base}/definir-senha?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`
}
