/** Shared currency options for quote, CI/PL, and other modules. */
export const CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'USD', label: 'USD - 美元' },
  { value: 'EUR', label: 'EUR - 欧元' },
  { value: 'GBP', label: 'GBP - 英镑' },
  { value: 'JPY', label: 'JPY - 日元' },
  { value: 'AUD', label: 'AUD - 澳元' },
  { value: 'CAD', label: 'CAD - 加元' },
  { value: 'AED', label: 'AED - 迪拉姆' },
  { value: 'SGD', label: 'SGD - 新加坡元' },
  { value: 'CNY', label: 'CNY - 人民币' },
  { value: 'HKD', label: 'HKD - 港币' },
]

export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    AED: 'AED ',
    SGD: 'S$',
    CNY: '¥',
    HKD: 'HK$',
  }
  return symbols[currency] || '$'
}
