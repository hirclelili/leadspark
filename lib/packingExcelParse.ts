/**
 * Heuristic packing list / PL Excel → normalized rows (factory exports vary widely).
 */

export interface ParsedPackingRow {
  name: string
  model: string
  specs: string
  qty: number
  unit: string
  unit_price_foreign: number
  /** Parsed from sheet when present */
  gw?: number
  nw?: number
  carton?: string
}

function normalizeHeader(h: string): string {
  return h.replace(/\s+/g, ' ').trim().toLowerCase()
}

function pickFirst(obj: Record<string, unknown>, tests: ((k: string) => boolean)[]): unknown {
  const keys = Object.keys(obj)
  for (const t of tests) {
    for (const k of keys) {
      if (t(normalizeHeader(String(k)))) return obj[k]
    }
  }
  return undefined
}

const isDesc = (k: string) =>
  /^(desc|description|product|item|name|cargo|goods|品名|品名规格|货物|物料|名称|description of goods)/i.test(
    k
  )
const isQty = (k: string) =>
  /^(qty|quantity|数量|件数|pcs|总数量|q'ty|qty\.)/i.test(k)
const isUnit = (k: string) => /^(unit|单位|uom|meas)/i.test(k)
const isCarton = (k: string) => /^(ctn|carton|箱|箱数|件数\(箱)/i.test(k)
const isNw = (k: string) => /^(n\.?w\.?|net\s*weight|净重)/i.test(k)
const isGw = (k: string) => /^(g\.?w\.?|grs\.?|gross\s*weight|毛重)/i.test(k)
const isModel = (k: string) => /^(model|型号|item\s*no|style)/i.test(k)

function num(x: unknown): number {
  if (x == null || x === '') return 0
  if (typeof x === 'number') return Number.isFinite(x) ? x : 0
  const s = String(x).replace(/,/g, '').replace(/[^\d.-]/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function rowObjectToParsed(row: Record<string, unknown>): ParsedPackingRow | null {
  const desc =
    pickFirst(row, [isDesc]) ??
    Object.values(row).find((v) => v != null && String(v).trim() !== '')

  const name = desc != null ? String(desc).trim() : ''
  if (!name) return null

  const qtyRaw = pickFirst(row, [isQty])
  let qty = num(qtyRaw)
  if (qty <= 0) qty = 1

  const unitVal = pickFirst(row, [isUnit])
  const unit = unitVal != null && String(unitVal).trim() ? String(unitVal).trim() : 'pc'

  const modelVal = pickFirst(row, [isModel])
  const cartonVal = pickFirst(row, [isCarton])

  const specsParts: string[] = []
  if (cartonVal != null && String(cartonVal).trim()) {
    specsParts.push(`Carton: ${String(cartonVal).trim()}`)
  }
  const nw = num(pickFirst(row, [isNw]))
  const gw = num(pickFirst(row, [isGw]))
  if (nw > 0) specsParts.push(`N.W.: ${nw}`)
  if (gw > 0) specsParts.push(`G.W.: ${gw}`)

  return {
    name,
    model: modelVal != null ? String(modelVal).trim() : '',
    specs: specsParts.join(' · '),
    qty,
    unit,
    unit_price_foreign: 0,
    gw: gw || undefined,
    nw: nw || undefined,
    carton: cartonVal != null ? String(cartonVal).trim() : undefined,
  }
}
