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

    // 1 CNY → 1 CNY (rates map does not include identity)
    if (targetCurrency === 'CNY') {
      return NextResponse.json({
        rate: 1,
        from: 'CNY',
        to: 'CNY',
        updatedAt: cacheUpdatedAt || new Date().toISOString(),
      })
    }

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
    // Hard-coded fallback rates (last reviewed: 2026-04)
    // Used only when live API is down AND no stale cache is available.
    // 1 CNY → X foreign currency (based on USD/CNY ≈ 7.28)
    const fallback: Record<string, number> = {
      USD: 0.1374,  // 1/7.28
      EUR: 0.1272,  // USD/CNY ÷ EUR/USD(1.08)
      GBP: 0.1082,  // USD/CNY ÷ GBP/USD(1.27)
      JPY: 20.72,   // USD/CNY × USD/JPY(150.8)
      AUD: 0.2178,  // USD/CNY ÷ AUD/USD(0.631)
      CAD: 0.1916,  // USD/CNY ÷ CAD/USD(0.717)
      AED: 0.5048,  // AED fixed ~3.67/USD
      SGD: 0.1840,  // USD/CNY ÷ SGD/USD(0.747)
      HKD: 1.074,   // HKD fixed ~7.78/USD
      CNY: 1,
    }
    return NextResponse.json({
      rate: fallback[targetCurrency] ?? 0.1374,
      from: 'CNY',
      to: targetCurrency,
      updatedAt: new Date().toISOString(),
      error: error.message,
    })
  }
}
