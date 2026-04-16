/**
 * Shared formatting utilities — single source of truth for dates and status labels.
 */

/** Unified date formatter. Output: "2024年1月15日" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** Short date for compact spaces: "1月15日" */
export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}

/** Quote / order status config — canonical across history list, detail page, customer detail */
export const QUOTE_STATUS_CONFIG = {
  draft:       { label: '草稿',   color: 'bg-gray-100 text-gray-600' },
  sent:        { label: '已发送', color: 'bg-blue-100 text-blue-700' },
  negotiating: { label: '议价中', color: 'bg-yellow-100 text-yellow-700' },
  won:         { label: '已成交', color: 'bg-green-100 text-green-700' },
  lost:        { label: '已流失', color: 'bg-red-100 text-red-600' },
} as const

export type QuoteStatus = keyof typeof QUOTE_STATUS_CONFIG
