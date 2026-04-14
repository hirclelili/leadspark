/**
 * Heuristic packing list / PL Excel → normalized rows (factory exports vary widely).
 * Supports real CI/PL columns: HS code, size, material, country of origin, packages, CBM, N.W., G.W.
 */

export interface ParsedPackingRow {
  name: string
  model: string
  hs_code: string
  size: string
  material: string
  country_of_origin: string
  qty: number
  unit: string
  no_of_packages: number
  cbm: number
  nw: number
  gw: number
  unit_price_foreign: number
  /** legacy */
  specs?: string
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

// ── Column matchers ────────────────────────────────────────────────────────────

const isDesc = (k: string) =>
  /^(desc|description|product|item|name|cargo|goods|品名|品名规格|货物|物料|名称|contents|contents of|description of goods)/i.test(k)

const isModel = (k: string) =>
  /^(model|item\s*code|item no|货号|型号|style|part\s*no|part number)/i.test(k)

const isHsCode = (k: string) =>
  /^(hs\s*code|hs no|customs code|tariff|税则|编码|hs)/i.test(k)

const isSize = (k: string) =>
  /^(size|dimension|meas|carton size|ctn size|外箱|尺寸|规格|size\/cm|size cm)/i.test(k)

const isMaterial = (k: string) =>
  /^(material|material\(s\)|material s|成分|材质|材料|fabric)/i.test(k)

const isCountryOfOrigin = (k: string) =>
  /^(country|origin|c\/o|country of origin|产地|原产地)/i.test(k)

const isQty = (k: string) =>
  /^(qty|quantity|数量|件数|pcs|总数量|q'ty|qty\.)/i.test(k)

const isUnit = (k: string) =>
  /^(unit|单位|uom|meas\b)/i.test(k)

const isPackages = (k: string) =>
  /^(no\.\s*of\s*package|no of pack|packages|pkgs|cartons?|ctn|箱数|件数\(箱\)|ctns|package)/i.test(k)

const isCbm = (k: string) =>
  /^(cbm|t'cbm|t cbm|total cbm|volume|体积|立方|m3)/i.test(k)

const isNw = (k: string) =>
  /^(n\.?w\.?|t'n\.?w|net\s*weight|净重)/i.test(k)

const isGw = (k: string) =>
  /^(g\.?w\.?|t'g\.?w|grs\.?|gross\s*weight|毛重)/i.test(k)

const isUnitPrice = (k: string) =>
  /^(unit\s*price|price|单价|u\/price)/i.test(k)

// ── Number helper ──────────────────────────────────────────────────────────────

function num(x: unknown): number {
  if (x == null || x === '') return 0
  if (typeof x === 'number') return Number.isFinite(x) ? x : 0
  const s = String(x).replace(/,/g, '').replace(/[^\d.-]/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function str(x: unknown): string {
  if (x == null) return ''
  return String(x).trim()
}

// ── Main export ────────────────────────────────────────────────────────────────

export function rowObjectToParsed(row: Record<string, unknown>): ParsedPackingRow | null {
  // Description / name (required)
  const desc =
    pickFirst(row, [isDesc]) ??
    Object.values(row).find((v) => v != null && String(v).trim() !== '')

  const name = desc != null ? String(desc).trim() : ''
  if (!name) return null

  // Qty
  let qty = num(pickFirst(row, [isQty]))
  if (qty <= 0) qty = 1

  // Unit
  const unitVal = pickFirst(row, [isUnit])
  const unit = str(unitVal) || 'pc'

  // Model / item code
  const model = str(pickFirst(row, [isModel]))

  // HS Code
  const hs_code = str(pickFirst(row, [isHsCode]))

  // Size / dimensions
  const size = str(pickFirst(row, [isSize]))

  // Material
  const material = str(pickFirst(row, [isMaterial]))

  // Country of origin
  const country_of_origin = str(pickFirst(row, [isCountryOfOrigin]))

  // Packages
  const no_of_packages = num(pickFirst(row, [isPackages]))

  // CBM
  const cbm = num(pickFirst(row, [isCbm]))

  // N.W. and G.W.
  const nw = num(pickFirst(row, [isNw]))
  const gw = num(pickFirst(row, [isGw]))

  // Unit price (optional, for CI sourced files)
  const unit_price_foreign = num(pickFirst(row, [isUnitPrice]))

  // Build legacy specs string for backward compat
  const specsParts: string[] = []
  if (no_of_packages > 0) specsParts.push(`PKGS: ${no_of_packages}`)
  if (nw > 0) specsParts.push(`N.W.: ${nw}`)
  if (gw > 0) specsParts.push(`G.W.: ${gw}`)

  return {
    name,
    model,
    hs_code,
    size,
    material,
    country_of_origin,
    qty,
    unit,
    no_of_packages,
    cbm,
    nw,
    gw,
    unit_price_foreign,
    specs: specsParts.join(' · '),
    carton: no_of_packages > 0 ? String(no_of_packages) : undefined,
  }
}
