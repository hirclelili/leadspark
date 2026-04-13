/**
 * English amount in words for invoice footers (major + minor units).
 * Sufficient for USD/CNY-style two-decimal amounts used in quotations.
 */
const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function wordsUnder1000(n: number): string {
  if (n < 20) return ONES[n]
  if (n < 100) {
    const t = Math.floor(n / 10)
    const o = n % 10
    return o === 0 ? TENS[t]! : `${TENS[t]!}-${ONES[o]!}`
  }
  const h = Math.floor(n / 100)
  const r = n % 100
  if (r === 0) return `${ONES[h]!} hundred`
  return `${ONES[h]!} hundred ${wordsUnder1000(r)}`
}

function wordsPositiveInt(n: number): string {
  if (n === 0) return 'zero'
  const parts: string[] = []
  let remaining = n
  const billion = Math.floor(remaining / 1_000_000_000)
  if (billion) {
    parts.push(`${wordsUnder1000(billion)} billion`)
    remaining %= 1_000_000_000
  }
  const million = Math.floor(remaining / 1_000_000)
  if (million) {
    parts.push(`${wordsUnder1000(million)} million`)
    remaining %= 1_000_000
  }
  const thousand = Math.floor(remaining / 1000)
  if (thousand) {
    parts.push(`${wordsUnder1000(thousand)} thousand`)
    remaining %= 1000
  }
  if (remaining) parts.push(wordsUnder1000(remaining))
  return parts.join(' ')
}

const CCY_LABEL: Record<string, string> = {
  USD: 'U.S. DOLLARS',
  EUR: 'EURO',
  GBP: 'POUND STERLING',
  CNY: 'CHINESE YUAN',
  HKD: 'HONG KONG DOLLARS',
  JPY: 'JAPANESE YEN',
  AUD: 'AUSTRALIAN DOLLARS',
  CAD: 'CANADIAN DOLLARS',
  SGD: 'SINGAPORE DOLLARS',
  AED: 'UAE DIRHAMS',
}

export function amountInWordsEn(amount: number, currencyCode: string): string {
  if (!Number.isFinite(amount)) return ''
  const major = Math.floor(Math.abs(amount))
  const cents = Math.round((Math.abs(amount) - major) * 100) % 100

  const majorWords = wordsPositiveInt(major).toUpperCase()
  const minorLabel = CCY_LABEL[currencyCode.toUpperCase()] || currencyCode.toUpperCase()
  const centsWord = cents < 20 ? ONES[cents] : wordsUnder1000(cents)
  return `SAY ${majorWords} ${minorLabel} AND ${centsWord}/100 ONLY`
}
