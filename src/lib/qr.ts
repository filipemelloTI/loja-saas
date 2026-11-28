import 'server-only'
import QRCode from 'qrcode'

/** QR code em SVG (preto no branco, sem margem), gerado no servidor para ir impresso no comprovante. */
export async function gerarQrSvg(texto: string): Promise<string> {
  return QRCode.toString(texto, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
}
