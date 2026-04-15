/**
 * Export Quotation or PI (Proforma Invoice) as a formatted .xlsx file.
 * Uses ExcelJS — matches the same visual style as exportCiPlExcel.
 */
import ExcelJS from 'exceljs'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuoteExcelProduct {
  name: string
  model?: string
  specs?: string
  qty: number
  unit: string
  unit_price_foreign: number
  amount_foreign: number
  is_container_header?: boolean
}

export interface QuoteExcelOptions {
  documentKind: 'QUOTATION' | 'PI'
  // Seller
  companyName: string
  companyNameCn?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  // Bank (PI only)
  bankBeneficiary?: string
  bankName?: string
  bankSwift?: string
  bankAccount?: string
  // Buyer
  clientName: string
  clientContact?: string
  clientAddress?: string
  // Header
  documentNumber: string
  date: string
  validityDays: number
  tradeTerm: string
  currency: string
  paymentTerms: string
  deliveryTime: string
  packing?: string
  remarks?: string
  poNumber?: string
  depositPercent?: number
  // Products
  products: QuoteExcelProduct[]
  totalAmount: number
  quoteSummaryLines?: { label: string; amountForeign: number }[]
}

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  headerBg:   'FF1e3a5f',
  headerFg:   'FFFFFFFF',
  titleBg:    'FF2d5a9e',
  infoBg:     'FFf0f4fb',
  totalsBg:   'FFdce8f5',
  altRowBg:   'FFf7f9fc',
  bankBg:     'FFf5f5f5',
  remarksBg:  'FFfffdf0',
  border:     'FFbbbbbb',
  darkBorder: 'FF333333',
  label:      'FF555555',
  black:      'FF111111',
}

type BS = ExcelJS.BorderStyle

function thin(color = C.border): Partial<ExcelJS.Borders> {
  const s = { style: 'thin' as BS, color: { argb: color } }
  return { top: s, bottom: s, left: s, right: s }
}
function thickBottom(): Partial<ExcelJS.Borders> {
  return {
    top:    { style: 'thin'   as BS, color: { argb: C.border } },
    left:   { style: 'thin'   as BS, color: { argb: C.border } },
    right:  { style: 'thin'   as BS, color: { argb: C.border } },
    bottom: { style: 'medium' as BS, color: { argb: C.darkBorder } },
  }
}

function sc(
  cell: ExcelJS.Cell,
  o: {
    value?: ExcelJS.CellValue
    bold?: boolean; italic?: boolean
    size?: number; color?: string; bg?: string
    align?: ExcelJS.Alignment['horizontal']
    valign?: ExcelJS.Alignment['vertical']
    wrap?: boolean; border?: Partial<ExcelJS.Borders>; fmt?: string
  }
) {
  if (o.value !== undefined) cell.value = o.value
  cell.font = { name: 'Calibri', size: o.size ?? 9, bold: o.bold ?? false, italic: o.italic ?? false, color: { argb: o.color ?? C.black } }
  if (o.bg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.bg } }
  cell.alignment = { horizontal: o.align ?? 'left', vertical: o.valign ?? 'middle', wrapText: o.wrap ?? false }
  if (o.border) cell.border = o.border
  if (o.fmt)   cell.numFmt = o.fmt
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function exportQuoteExcel(opts: QuoteExcelOptions): Promise<void> {
  const {
    documentKind, companyName, companyNameCn, address, phone, email, website,
    bankBeneficiary, bankName, bankSwift, bankAccount,
    clientName, clientContact, clientAddress,
    documentNumber, date, validityDays, tradeTerm, currency,
    paymentTerms, deliveryTime, packing, remarks, poNumber, depositPercent,
    products, totalAmount, quoteSummaryLines,
  } = opts

  const isPI  = documentKind === 'PI'
  const sym   = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'CNY' ? '¥' : `${currency} `
  const COLS  = 8  // S/N | Description | Model | Specs | Qty | Unit | Unit Price | Amount
  const lastC = 'H'

  function L(n: number) { return String.fromCharCode(64 + n) }   // 1→A, 2→B …
  function sp(c1: number, c2: number, row: number) { return `${L(c1)}${row}:${L(c2)}${row}` }

  const wb = new ExcelJS.Workbook()
  wb.creator = companyName
  wb.created = new Date()

  const ws = wb.addWorksheet(documentKind, {
    pageSetup: {
      paperSize: 9, orientation: 'portrait',
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.6, right: 0.6, top: 0.8, bottom: 0.8, header: 0.3, footer: 0.3 },
    },
  })

  // Column widths: S/N | Description | Model | Specs | Qty | Unit | Unit Price | Amount
  ;[4, 32, 14, 16, 7, 6, 14, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w })

  let r = 1

  // ── Company name ─────────────────────────────────────────────────────────
  ws.getRow(r).height = 24
  ws.mergeCells(`A${r}:${lastC}${r}`)
  sc(ws.getCell(`A${r}`), { value: companyName + (companyNameCn ? `  ${companyNameCn}` : ''), bold: true, size: 14, color: C.headerFg, bg: C.headerBg, align: 'center' })
  r++

  const infoLine = [address, [phone && `Tel: ${phone}`, email && `Email: ${email}`, website && `Web: ${website}`].filter(Boolean).join('   ')].filter(Boolean).join('   |   ')
  if (infoLine) {
    ws.getRow(r).height = 13
    ws.mergeCells(`A${r}:${lastC}${r}`)
    sc(ws.getCell(`A${r}`), { value: infoLine, size: 8, color: 'FFaaaaaa', bg: C.headerBg, align: 'center' })
    r++
  }

  // Gap
  ws.getRow(r).height = 5; r++

  // ── Document title ────────────────────────────────────────────────────────
  ws.getRow(r).height = 22
  ws.mergeCells(`A${r}:${lastC}${r}`)
  const titleText = isPI ? 'PROFORMA INVOICE' : 'QUOTATION'
  sc(ws.getCell(`A${r}`), { value: titleText, bold: true, size: 16, color: C.headerFg, bg: C.titleBg, align: 'center' })
  r++

  // ── Info grid ─────────────────────────────────────────────────────────────
  const half = 4

  function addInfo2(l1: string, v1: string, l2 = '', v2 = '') {
    if (!v1 && !v2) return
    ws.getRow(r).height = 13
    ws.mergeCells(sp(1, half, r))
    ws.mergeCells(sp(half + 1, COLS, r))
    sc(ws.getCell(`A${r}`), { value: `${l1}${v1}`, bg: C.infoBg, border: thin(), size: 8.5 })
    sc(ws.getCell(L(half + 1) + r), { value: l2 ? `${l2}${v2}` : '', bg: C.infoBg, border: thin(), size: 8.5 })
    r++
  }

  addInfo2('Invoice No.:  ', documentNumber, 'Date:  ', date)
  addInfo2('To:  ', clientName)
  if (clientContact) addInfo2('Attn:  ', clientContact)
  if (clientAddress) addInfo2('Address:  ', clientAddress)
  if (poNumber)      addInfo2("Buyer's PO:  ", poNumber)
  addInfo2('Trade Term:  ', tradeTerm, 'Currency:  ', currency)
  addInfo2('Payment Terms:  ', paymentTerms, 'Delivery Time:  ', deliveryTime)
  addInfo2('Validity:  ', `${validityDays} days`)
  if (packing) addInfo2('Packing:  ', packing)

  // Gap
  ws.getRow(r).height = 5; r++

  // ── Table header ──────────────────────────────────────────────────────────
  ws.getRow(r).height = 26
  const headers = ['S/N', 'DESCRIPTION', 'ITEM CODE', 'SPECIFICATIONS', 'QTY', 'UNIT', `UNIT PRICE\n(${currency})`, `AMOUNT\n(${currency})`]
  headers.forEach((h, i) => {
    sc(ws.getCell(L(i + 1) + r), {
      value: h, bold: true, size: 8, color: C.headerFg, bg: C.headerBg,
      align: i >= 4 ? 'center' : 'left', wrap: true,
      border: { ...thin(C.headerBg), right: { style: 'thin' as BS, color: { argb: 'FF4a6fa0' } } },
    })
  })
  r++

  // ── Product rows ──────────────────────────────────────────────────────────
  let sn = 0
  for (const p of products) {
    if (p.is_container_header) {
      // Section header row (container / lot title)
      ws.getRow(r).height = 14
      ws.mergeCells(`A${r}:${lastC}${r}`)
      sc(ws.getCell(`A${r}`), { value: p.name, bold: true, bg: 'FFe8edf5', border: thin(), size: 8.5 })
      r++
      continue
    }
    sn++
    const isAlt = sn % 2 === 0
    ws.getRow(r).height = 15
    const vals = [sn, p.name, p.model || '', p.specs || '', p.qty, p.unit, p.unit_price_foreign, p.amount_foreign]
    vals.forEach((v, i) => {
      sc(ws.getCell(L(i + 1) + r), {
        value: v,
        bg: isAlt ? C.altRowBg : 'FFFFFFFF',
        border: thin(),
        align: i >= 4 ? 'center' : 'left',
        fmt: i === 6 || i === 7 ? `"${sym}"#,##0.00` : i === 4 ? '#,##0' : undefined,
      })
    })
    r++
  }

  // ── Summary lines (dual-term, optional) ──────────────────────────────────
  if (quoteSummaryLines?.length) {
    for (const line of quoteSummaryLines) {
      ws.getRow(r).height = 14
      ws.mergeCells(sp(1, COLS - 1, r))
      sc(ws.getCell(`A${r}`), { value: line.label, bg: C.infoBg, border: thin(), italic: true, size: 8.5, align: 'right' })
      sc(ws.getCell(`${lastC}${r}`), { value: line.amountForeign, bg: C.infoBg, border: thin(), fmt: `"${sym}"#,##0.00`, align: 'center' })
      r++
    }
  }

  // ── Totals row ────────────────────────────────────────────────────────────
  ws.getRow(r).height = 18
  const totalsVals: (string | number)[] = ['TOTAL', '', '', '', products.filter(p => !p.is_container_header).reduce((s, p) => s + p.qty, 0), '', '', totalAmount]
  totalsVals.forEach((v, i) => {
    sc(ws.getCell(L(i + 1) + r), {
      value: v, bold: true, bg: C.totalsBg, border: thickBottom(),
      align: i >= 4 ? 'center' : i === 0 ? 'center' : 'left',
      fmt: i === 7 ? `"${sym}"#,##0.00` : i === 4 ? '#,##0' : undefined,
    })
  })
  r++

  // ── Amount in words ───────────────────────────────────────────────────────
  if (totalAmount > 0) {
    const { amountInWordsEn } = await import('@/lib/amountInWords')
    ws.getRow(r).height = 14
    ws.mergeCells(`A${r}:${lastC}${r}`)
    sc(ws.getCell(`A${r}`), { value: amountInWordsEn(totalAmount, currency), bold: true, size: 8, bg: C.remarksBg, border: thin('FFdddddd') })
    r++
  }

  // ── Deposit line (PI) ─────────────────────────────────────────────────────
  if (isPI && depositPercent && depositPercent > 0) {
    const deposit = totalAmount * depositPercent / 100
    ws.getRow(r).height = 14
    ws.mergeCells(sp(1, COLS - 1, r))
    sc(ws.getCell(`A${r}`), { value: `Deposit (${depositPercent}%):`, bg: C.infoBg, border: thin(), bold: true, align: 'right', size: 8.5 })
    sc(ws.getCell(`${lastC}${r}`), { value: deposit, bg: C.infoBg, border: thin(), bold: true, fmt: `"${sym}"#,##0.00`, align: 'center' })
    r++
    ws.getRow(r).height = 14
    ws.mergeCells(sp(1, COLS - 1, r))
    sc(ws.getCell(`A${r}`), { value: `Balance (${100 - depositPercent}%):`, bg: C.infoBg, border: thin(), bold: true, align: 'right', size: 8.5 })
    sc(ws.getCell(`${lastC}${r}`), { value: totalAmount - deposit, bg: C.infoBg, border: thin(), bold: true, fmt: `"${sym}"#,##0.00`, align: 'center' })
    r++
  }

  // Gap
  ws.getRow(r).height = 5; r++

  // ── Bank info (PI) ────────────────────────────────────────────────────────
  if (isPI && (bankBeneficiary || bankName || bankSwift || bankAccount)) {
    ws.getRow(r).height = 14
    ws.mergeCells(`A${r}:${lastC}${r}`)
    sc(ws.getCell(`A${r}`), { value: "SELLER'S BANK DETAILS", bold: true, size: 9, bg: C.bankBg, border: thin() })
    r++
    for (const [label, val] of [
      ['Beneficiary:', bankBeneficiary],
      ['Bank Name:',   bankName],
      ['SWIFT Code:',  bankSwift],
      ['Account No.:', bankAccount],
    ] as [string, string | undefined][]) {
      if (!val) continue
      ws.getRow(r).height = 13
      ws.mergeCells(`A${r}:B${r}`)
      ws.mergeCells(`C${r}:${lastC}${r}`)
      sc(ws.getCell(`A${r}`), { value: label, bold: true, bg: C.bankBg, border: thin(), size: 8.5, color: C.label })
      sc(ws.getCell(`C${r}`), { value: val, bg: C.bankBg, border: thin(), size: 8.5 })
      r++
    }
    ws.getRow(r).height = 5; r++
  }

  // ── Remarks ───────────────────────────────────────────────────────────────
  if (remarks) {
    ws.getRow(r).height = 13
    ws.mergeCells(`A${r}:${lastC}${r}`)
    sc(ws.getCell(`A${r}`), { value: 'REMARKS:', bold: true, size: 8.5, bg: C.remarksBg, border: thin() })
    r++
    ws.getRow(r).height = Math.min(200, Math.max(13, Math.ceil(remarks.length / 80) * 13))
    ws.mergeCells(`A${r}:${lastC}${r}`)
    sc(ws.getCell(`A${r}`), { value: remarks, size: 8.5, bg: C.remarksBg, border: thin(), wrap: true })
    r++
    ws.getRow(r).height = 5; r++
  }

  // ── Signature row (PI) ────────────────────────────────────────────────────
  if (isPI) {
    ws.getRow(r).height = 30
    ws.mergeCells(sp(1, 3, r))
    ws.mergeCells(sp(5, COLS, r))
    sc(ws.getCell(`A${r}`), { value: 'THE BUYER: _________________________', align: 'center', valign: 'bottom', size: 9, color: C.label })
    sc(ws.getCell(`E${r}`), { value: 'THE SELLER: _________________________', align: 'center', valign: 'bottom', size: 9, color: C.label })
    r++
  }

  // ── Download ──────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a')
  a.href     = url
  a.download = `${documentNumber.replace(/[/\\?%*:|"<>]/g, '-')}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
