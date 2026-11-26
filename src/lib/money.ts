const cache = new Map<string, Intl.NumberFormat>()

function fmt(currency: string, digits: number): Intl.NumberFormat {
  const key = `${currency}:${digits}`
  let f = cache.get(key)
  if (!f) {
    f = new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    cache.set(key, f)
  }
  return f
}

export function money(amount: number, currency: string, digits = 2): string {
  return fmt(currency, digits).format(amount)
}

/** Whole units, for chart labels and large projections. */
export function moneyRound(amount: number, currency: string): string {
  return fmt(currency, 0).format(Math.round(amount))
}

export const CURRENCIES = ['MYR', 'SGD', 'USD', 'GBP', 'EUR', 'AUD', 'IDR', 'JPY'] as const
