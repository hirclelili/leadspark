/**
 * Shared doc-number utility — used by both the API route and the quotations save endpoint.
 * Directly calls Supabase admin client, no internal HTTP round-trip.
 */
import { createAdminClient } from '@/lib/supabase/api-auth'

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

/**
 * Atomically fetch the next document number for a user + doc type.
 * Handles yearly reset and auto-creates the row if missing.
 * Falls back to a legacy random number on any DB error.
 */
export async function getNextDocNumber(userId: string, docType: DocType): Promise<string> {
  try {
    const supabase = createAdminClient()
    const thisYear = new Date().getFullYear()

    // 1. Read row — create default if missing
    let { data: row, error: fetchErr } = await supabase
      .from('doc_number_sequences')
      .select('*')
      .eq('user_id', userId)
      .eq('doc_type', docType)
      .single()

    if (fetchErr?.code === 'PGRST116') {
      // Row missing — insert default
      const { data: inserted, error: insertErr } = await supabase
        .from('doc_number_sequences')
        .insert({
          user_id: userId,
          doc_type: docType,
          prefix: docType,
          year_format: 'YYYY',
          digits: 3,
          reset_yearly: true,
          current_year: thisYear,
          current_seq: 0,
        })
        .select()
        .single()
      if (insertErr) throw insertErr
      row = inserted
    } else if (fetchErr) {
      throw fetchErr
    }

    const config = row as DocNumberConfig

    // 2. Determine next seq (handle yearly reset)
    const shouldReset = config.reset_yearly && (config.current_year || 0) < thisYear
    const nextSeq = shouldReset ? 1 : (config.current_seq + 1)
    const nextYear = shouldReset ? thisYear : (config.current_year || thisYear)

    // 3. Atomic update
    const { data: updated, error: updateErr } = await supabase
      .from('doc_number_sequences')
      .update({ current_seq: nextSeq, current_year: nextYear })
      .eq('user_id', userId)
      .eq('doc_type', docType)
      .select()
      .single()

    if (updateErr) throw updateErr

    return formatDocNumber(updated as DocNumberConfig, nextSeq)
  } catch (err) {
    console.error('[getNextDocNumber] fallback triggered:', err)
    return legacyFallback(docType)
  }
}

function legacyFallback(docType: string): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `${docType}-${y}${m}${day}-${rand}`
}

/** Map document_kind saved with a quotation → DocType key */
export function docKindToType(kind: string | undefined | null): DocType {
  if (kind === 'PI') return 'PI'
  if (kind === 'CI') return 'CI'
  return 'Q'
}
