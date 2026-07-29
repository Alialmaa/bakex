/**
 * How a customer can pay, read from the environment.
 *
 * The annual subscription is a single charge once a year, so this needs no
 * recurring billing, no stored cards and no webhooks — a payment link is enough.
 * Set PAYMENT_LINK_URL to a link from a SAMA-licensed gateway and the card
 * button appears; leave it unset and the page falls back to bank transfer and
 * WhatsApp, which is how it worked before.
 *
 * Nothing here is secret: these values are rendered on the billing page.
 */

export interface PaymentConfig {
  /** Yearly price in SAR. */
  price: number
  /** Hosted payment link, or null when none is configured yet. */
  link: string | null
  bank: { name: string; iban: string; accountName: string } | null
  whatsapp: string
}

export const YEARLY_PRICE = 2500

const WHATSAPP_DEFAULT = '966559219189'

/** Only https links are accepted — a payment link is where money goes. */
function safeLink(raw?: string): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/** IBANs are shown to the payer, so normalise the spacing rather than trusting the env var's. */
export function formatIban(raw: string): string {
  const clean = raw.replace(/\s+/g, '').toUpperCase()
  return clean.replace(/(.{4})/g, '$1 ').trim()
}

export function paymentConfig(): PaymentConfig {
  const name = process.env.BANK_NAME?.trim()
  const iban = process.env.BANK_IBAN?.trim()
  const accountName = process.env.BANK_ACCOUNT_NAME?.trim()

  return {
    price: YEARLY_PRICE,
    link: safeLink(process.env.PAYMENT_LINK_URL),
    // Partial bank details are worse than none — a payer cannot act on them.
    bank: name && iban && accountName ? { name, iban: formatIban(iban), accountName } : null,
    whatsapp: process.env.SUPPORT_WHATSAPP?.replace(/\D/g, '') || WHATSAPP_DEFAULT,
  }
}

/**
 * Stamps the bakery onto the payment link.
 *
 * The webhook refuses any payment it cannot attribute — `metadata.bakery_id` is
 * how a charge at the gateway becomes a subscription here, and it is the only
 * part of this the customer's browser touches. Sending the wrong id would only
 * ever credit someone else, which is why the id comes from the session on the
 * server, not from the page.
 *
 * If the gateway drops the parameter the webhook logs `no_bakery` and activates
 * nothing, so a mistake here is visible rather than expensive. Confirm it with
 * one real payment before pointing customers at the link.
 */
export function paymentLinkFor(link: string | null, bakeryId?: string | null): string | null {
  if (!link || !bakeryId) return link
  try {
    const u = new URL(link)
    u.searchParams.set('metadata[bakery_id]', bakeryId)
    return u.toString()
  } catch {
    return link
  }
}

export const whatsappUrl = (number: string, text: string) =>
  `https://wa.me/${number}?text=${encodeURIComponent(text)}`
