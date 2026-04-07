import { NextResponse } from 'next/server'

// In-memory cache
let cachedRate: { rate: number; updatedAt: string } | null = null
let cacheTime = 0
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { targetCurrency = 'USD' } = body

    const now = Date.now()

    // Check cache
    if (cachedRate && now - cacheTime < CACHE_DURATION) {
      return NextResponse.json({
        rate: cachedRate.rate,
        from: 'CNY',
        to: targetCurrency,
        updatedAt: cachedRate.updatedAt,
      })
    }

    // Fetch from API
    const res = await fetch(
      `https://open.er-api.com/v6/latest/CNY`,
      { next: { revalidate: 3600 } }
    )

    if (!res.ok) {
      throw new Error('Failed to fetch exchange rate')
    }

    const data = await res.json()

    if (data.result !== 'success') {
      throw new Error('API error')
    }

    const rates = data.rates || {}
    const rate = rates[targetCurrency] || 1

    // Update cache
    cachedRate = { rate, updatedAt: new Date().toISOString() }
    cacheTime = now

    return NextResponse.json({
      rate,
      from: 'CNY',
      to: targetCurrency,
      updatedAt: cachedRate.updatedAt,
    })
  } catch (error: any) {
    // Return default rate if API fails
    const defaultRates: Record<string, number> = {
      USD: 0.14,
      EUR: 0.13,
      GBP: 0.11,
    }
    return NextResponse.json({
      rate: defaultRates.USD || 0.14,
      from: 'CNY',
      to: 'USD',
      updatedAt: new Date().toISOString(),
      error: error.message,
    })
  }
}