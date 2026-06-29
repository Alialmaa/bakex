// ZATCA Phase 1 — Simplified e-invoice QR code (TLV encoding)
// https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/E-invoicing%20Detailed%20Technical%20Guidelines.pdf

function tlv(tag: number, value: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 128) {
      bytes.push(code)
    } else if (code < 2048) {
      bytes.push(0xC0 | (code >> 6))
      bytes.push(0x80 | (code & 0x3F))
    } else {
      bytes.push(0xE0 | (code >> 12))
      bytes.push(0x80 | ((code >> 6) & 0x3F))
      bytes.push(0x80 | (code & 0x3F))
    }
  }
  return [tag, bytes.length, ...bytes]
}

export function generateZATCAQR(params: {
  sellerName: string
  vatNumber: string
  timestamp: string   // ISO 8601
  totalWithVat: string
  vatAmount: string
}): string {
  const data = [
    ...tlv(1, params.sellerName),
    ...tlv(2, params.vatNumber || ''),
    ...tlv(3, params.timestamp),
    ...tlv(4, params.totalWithVat),
    ...tlv(5, params.vatAmount),
  ]
  return Buffer.from(data).toString('base64')
}

export function vatCalc(subtotal: number, rate = 15) {
  const vatAmount = parseFloat((subtotal * rate / 100).toFixed(2))
  const total = parseFloat((subtotal + vatAmount).toFixed(2))
  return { subtotal, vatRate: rate, vatAmount, total }
}

export function toHijri(date: Date): string {
  try {
    return date.toLocaleDateString('ar-SA-u-ca-islamic', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
  } catch {
    return date.toLocaleDateString('ar-SA')
  }
}
