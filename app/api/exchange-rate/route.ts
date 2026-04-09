import { NextResponse } from 'next/server'

// Cache all rates from a single API call (CNY as base)
let allRatesCache: Record<string, number> | null = null
let cacheTime = 0
let cacheUpdatedAt = ''
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

export async function POST(request: Request) {
  let targetCurrency = 'USD'

  try {
    const body = await request.json()
    targetCurrency = body.targetCurrency || 'USD'

    const now = Date.now()

    // Return from cache if still fresh (all currencies cached together)
    if (allRatesCache && now - cacheTime < CACHE_DURATION) {
      const rate = allRatesCache[targetCurrency]
      if (rate) {
        return NextResponse.json({
          rate,
          from: 'CNY',
          to: targetCurrency,
          updatedAt: cacheUpdatedAt,
        })
      }
    }

    // Fetch all rates with CNY as base currency
    const res = await fetch('https://open.er-api.com/v6/latest/CNY')
    if (!res.ok) throw new Error('Exchange rate API unavailable')

    const data = await res.json()
    if (data.result !== 'success') throw new Error('Exchange rate API error')

    // Cache the full rate map
    allRatesCache = data.rates || {}
    cacheTime = now
    cacheUpdatedAt = new Date().toISOString()

    const rate = allRatesCache![targetCurrency]
    if (!rate) throw new Error(`Currency not found: ${targetCurrency}`)

    return NextResponse.json({
      rate,
      from: 'CNY',
      to: targetCurrency,
      updatedAt: cacheUpdatedAt,
    })
  } catch (error: any) {
    // Try stale cache first before hard fallback
    if (allRatesCache?.[targetCurrency]) {
      return NextResponse.json({
        rate: allRatesCache[targetCurrency],
        from: 'CNY',
        to: targetCurrency,
        updatedAt: cacheUpdatedAt,
        warning: 'stale cache',
      })
    }
    // Hard-coded fallback rates
    const fallback: Record<string, number> = { USD: 0.1380, EUR: 0.1270, GBP: 0.1090 }
    return NextResponse.json({
      rate: fallback[targetCurrency] ?? 0.138,
      from: 'CNY',
      to: targetCurrency,
      updatedAt: new Date().toISOString(),
      error: error.message,
    })
  }
}
