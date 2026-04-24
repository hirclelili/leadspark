/**
 * Client-safe doc-number utilities — no server imports.
 * Import this in client components instead of lib/docNumber.ts
 */

export type YearFormat = 'YYYY' | 'YY' | 'YYYYMMDD' | 'none'
export type DocType = 'Q' | 'PI' | 'CI'

export interface DocNumberConfig {
  doc_type: DocType
  prefix: string
  year_format: YearFormat
  digits: number
  reset_yearly: boolean
  current_year: number
  current_seq: number
}

/** Format a document number from config + seq. Used for preview and production. */
export function formatDocNumber(
  config: Pick<DocNumberConfig, 'prefix' | 'year_format' | 'digits'>,
  seq: number,
  date = new Date(),
): string {
  const parts: string[] = []
  if (config.prefix.trim()) parts.push(config.prefix.trim())

  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')

  if (config.year_format === 'YYYY')         parts.push(String(y))
  else if (config.year_format === 'YY')       parts.push(String(y).slice(2))
  else if (config.year_format === 'YYYYMMDD') parts.push(`${y}${mo}${d}`)
  // 'none' → no date segment

  parts.push(String(seq).padStart(Math.max(2, config.digits), '0'))
  return parts.join('-')
}

/** Preview the NEXT number without advancing the counter. */
export function previewNextDocNumber(config: DocNumberConfig): string {
  const thisYear = new Date().getFullYear()
  const shouldReset = config.reset_yearly && (config.current_year || 0) < thisYear
  const nextSeq = shouldReset ? 1 : (config.current_seq + 1)
  return formatDocNumber(config, nextSeq)
}
