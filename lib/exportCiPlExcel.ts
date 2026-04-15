/**
 * Export CI (Commercial Invoice) or PL (Packing List) as a formatted .xlsx file.
 * Uses ExcelJS for full cell styling: borders, fills, fonts, merged cells, alignment.
 *
 * Works in the browser via writeBuffer() → Blob → download link.
 */
import ExcelJS from 'exceljs'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExcelProduct {
  name: string
  model?: string
  hs_code?: string
  size?: string
  material?: string
  country_of_origin?: string
  qty: number
  unit: string
  no_of_packages?: number
  cbm?: number
  nw?: number
  gw?: number
  unit_price_foreign?: number
  amount_foreign?: number
}

export interface ExcelCiPlOptions {
  mode: 'CI' | 'PL'
  companyName: string
  companyNameCn?: string
  address?: string
  phone?: string
  email?: string
  bankBeneficiary?: string
  bankName?: string
  bankSwift?: string
  bankAccount?: string
  bankAddress?: string
  clientName: string
  clientContact?: string
  clientAddress?: string
  clientPhone?: string
  documentNumber: string
  date: string
  currency: string
  tradeTerm?: string
  paymentTerms?: string
  portOfLoading?: string
  portOfDischarge?: string
  vesselVoyage?: string
  containerNumber?: string
  sealNumber?: string
  products: ExcelProduct[]
  totalAmount?: number
  totalPackages?: number
  totalCbm?: number
  totalNw?: number
  totalGw?: number
}

// ─── Color palette ────────────────────────────────────────────────────────────

const COLOR = {
  headerBg:    'FF1e3a5f',   // dark navy — column headers
  headerFg:    'FFFFFFFF',   // white text
  titleBg:     'FF2d5a9e',   // mid-blue — document title
  infoBg:      'FFf0f4fb',   // very light blue — info rows
  totalsBg:    'FFdce8f5',   // light blue — totals row
  altRowBg:    'FFf7f9fc',   // subtle stripe
  bankBg:      'FFf5f5f5',   // light grey — bank section
  borderColor: 'FFbbbbbb',   // light grey border
  darkBorder:  'FF333333',   // dark border for totals
  labelColor:  'FF555555',   // grey labels
  black:       'FF111111',
}

// ─── Border helpers ───────────────────────────────────────────────────────────

type BorderStyle = ExcelJS.BorderStyle

function thinBorder(color = COLOR.borderColor): Partial<ExcelJS.Borders> {
  const side = { style: 'thin' as BorderStyle, color: { argb: color } }
  return { top: side, bottom: side, left: side, right: side }
}

function thickBottom(color = COLOR.darkBorder): Partial<ExcelJS.Borders> {
  return {
    top:    { style: 'thin',   color: { argb: COLOR.borderColor } },
    left:   { style: 'thin',   color: { argb: COLOR.borderColor } },
    right:  { style: 'thin',   color: { argb: COLOR.borderColor } },
    bottom: { style: 'medium', color: { argb: color } },
  }
}

// ─── Cell setter ─────────────────────────────────────────────────────────────

function styleCell(
  cell: ExcelJS.Cell,
  opts: {
    value?: ExcelJS.CellValue
    bold?: boolean
    fontSize?: number
    color?: string          // ARGB fg text colour
    bgColor?: string        // ARGB fill colour
    align?: ExcelJS.Alignment['horizontal']
    valign?: ExcelJS.Alignment['vertical']
    wrapText?: boolean
    border?: Partial<ExcelJS.Borders>
    numFmt?: string
    italic?: boolean
  }
) {
  if (opts.value !== undefined) cell.value = opts.value
  cell.font = {
    name: 'Calibri',
    size: opts.fontSize ?? 9,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    color: { argb: opts.color ?? COLOR.black },
  }
  if (opts.bgColor) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bgColor } }
  }
  cell.alignment = {
    horizontal: opts.align ?? 'left',
    vertical:   opts.valign ?? 'middle',
    wrapText:   opts.wrapText ?? false,
  }
  if (opts.border) cell.border = opts.border
  if (opts.numFmt) cell.numFmt = opts.numFmt
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function exportCiPlExcel(opts: ExcelCiPlOptions): Promise<void> {
  const {
    mode,
    companyName, companyNameCn, address, phone, email,
    bankBeneficiary, bankName, bankSwift, bankAccount, bankAddress,
    clientName, clientContact, clientAddress, clientPhone,
    documentNumber, date, currency, tradeTerm, paymentTerms,
    portOfLoading, portOfDischarge, vesselVoyage, containerNumber, sealNumber,
    products,
  } = opts

  const isCi  = mode === 'CI'
  const cols  = isCi ? 15 : 13          // total column count
  const lastC = isCi ? 'O' : 'M'        // last column letter
  const sym   = currency === 'USD' ? '$'
              : currency === 'EUR' ? '€'
              : currency === 'GBP' ? '£'
              : currency === 'CNY' ? '¥'
              : `${currency} `

  // Column letters helper
  function colLetter(n: number) { // 1-based
    return String.fromCharCode(64 + n)
  }
  function span(c1: number, c2: number, row: number) {
    return `${colLetter(c1)}${row}:${colLetter(c2)}${row}`
  }

  const wb = new ExcelJS.Workbook()
  wb.creator  = companyName
  wb.created  = new Date()
  wb.modified = new Date()

  const ws = wb.addWorksheet(mode, {
    pageSetup: {
      paperSize: 9,          // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
    },
  })

  // ── Column widths ──────────────────────────────────────────────────────────
  //  A   B        C       D       E           F         G    H    I     J     K       L         M         N          O
  // S/N  ItemCode  HSCode  Size    Description Material  C/O  Qty  Unit  Pkgs  T'CBM   T'N.W     T'G.W     UnitPrice  Amount
  const widths = [4, 13, 11, 11, 26, 13, 7, 8, 6, 6, 8, 9, 9, 13, 13]
  widths.slice(0, cols).forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })

  // Track current row
  let r = 1

  // ── Row 1: Company name ────────────────────────────────────────────────────
  ws.getRow(r).height = 24
  ws.mergeCells(`A${r}:${lastC}${r}`)
  styleCell(ws.getCell(`A${r}`), {
    value:   companyName + (companyNameCn ? `  ${companyNameCn}` : ''),
    bold:    true,
    fontSize: 14,
    color:   COLOR.headerFg,
    bgColor: COLOR.headerBg,
    align:   'center',
    valign:  'middle',
  })
  r++

  // ── Row 2-4: Address / Tel / Email ─────────────────────────────────────────
  const infoLines = [
    address,
    [phone && `Tel: ${phone}`, email && `Email: ${email}`].filter(Boolean).join('    '),
  ].filter(Boolean) as string[]

  for (const line of infoLines) {
    ws.getRow(r).height = 14
    ws.mergeCells(`A${r}:${lastC}${r}`)
    styleCell(ws.getCell(`A${r}`), {
      value:   line,
      fontSize: 8,
      color:   'FF888888',
      bgColor: COLOR.headerBg,
      align:   'center',
    })
    r++
  }

  // ── Gap ────────────────────────────────────────────────────────────────────
  ws.getRow(r).height = 6
  r++

  // ── Document title ─────────────────────────────────────────────────────────
  ws.getRow(r).height = 22
  ws.mergeCells(`A${r}:${lastC}${r}`)
  styleCell(ws.getCell(`A${r}`), {
    value:   isCi ? 'COMMERCIAL INVOICE' : 'PACKING LIST',
    bold:    true,
    fontSize: 16,
    color:   COLOR.headerFg,
    bgColor: COLOR.titleBg,
    align:   'center',
  })
  r++

  // ── Document info block ────────────────────────────────────────────────────
  ws.getRow(r).height = 14
  const halfC = Math.floor(cols / 2)
  ws.mergeCells(span(1, halfC, r))
  ws.mergeCells(span(halfC + 1, cols, r))
  styleCell(ws.getCell(`A${r}`), { value: `Invoice No.:  ${documentNumber}`, bold: true, bgColor: COLOR.infoBg, border: thinBorder() })
  styleCell(ws.getCell(colLetter(halfC + 1) + r), { value: `Date:  ${date}`, bgColor: COLOR.infoBg, border: thinBorder() })
  r++

  // Helper to add a 2-column info row
  function addInfoRow(label: string, value: string, label2 = '', value2 = '') {
    if (!value && !value2) return
    ws.getRow(r).height = 13
    ws.mergeCells(span(1, halfC, r))
    ws.mergeCells(span(halfC + 1, cols, r))
    styleCell(ws.getCell(`A${r}`), {
      value:   `${label}${value}`,
      bgColor: COLOR.infoBg,
      border:  thinBorder(),
      fontSize: 8.5,
    })
    styleCell(ws.getCell(colLetter(halfC + 1) + r), {
      value:   label2 ? `${label2}${value2}` : '',
      bgColor: COLOR.infoBg,
      border:  thinBorder(),
      fontSize: 8.5,
    })
    r++
  }

  addInfoRow('To:  ', clientName)
  if (clientContact) addInfoRow('Attn:  ', clientContact)
  if (clientPhone)   addInfoRow('Tel:  ', clientPhone)
  if (clientAddress) addInfoRow('Address:  ', clientAddress)
  addInfoRow('Port of Loading:  ', portOfLoading || '—', 'Port of Discharge:  ', portOfDischarge || '—')
  if (vesselVoyage || containerNumber) {
    addInfoRow('Vessel / Voyage:  ', vesselVoyage || '—', 'Container No.:  ', containerNumber || '—')
  }
  if (sealNumber) addInfoRow('Seal No.:  ', sealNumber)
  if (tradeTerm)  addInfoRow('Trade Term:  ', tradeTerm, isCi && paymentTerms ? 'Payment Terms:  ' : '', isCi ? paymentTerms || '' : '')
  if (isCi)       addInfoRow('Currency:  ', currency)

  // ── Gap before table ───────────────────────────────────────────────────────
  ws.getRow(r).height = 6
  r++

  // ── Table header row ───────────────────────────────────────────────────────
  ws.getRow(r).height = 28

  const headers = [
    'S/N', 'ITEM CODE', 'HS CODE', 'SIZE/CM', 'DESCRIPTION',
    'MATERIAL', 'C/O', 'QTY', 'UNIT', 'PKGS',
    "T'CBM", "T'N.W\n(KG)", "T'G.W\n(KG)",
    ...(isCi ? [`UNIT PRICE\n(${currency})`, `AMOUNT\n(${currency})`] : []),
  ]

  headers.forEach((h, i) => {
    styleCell(ws.getCell(colLetter(i + 1) + r), {
      value:    h,
      bold:     true,
      fontSize: 8,
      color:    COLOR.headerFg,
      bgColor:  COLOR.headerBg,
      align:    i === 4 || i === 5 ? 'left' : 'center',
      wrapText: true,
      border:   { ...thinBorder(COLOR.headerBg), right: { style: 'thin', color: { argb: 'FF4a6fa0' } } },
    })
  })
  r++

  // ── Product rows ───────────────────────────────────────────────────────────
  const dataRows = products
  let sn = 0

  for (const p of dataRows) {
    sn++
    const isAlt = sn % 2 === 0
    const bg    = isAlt ? COLOR.altRowBg : 'FFFFFFFF'
    ws.getRow(r).height = 15

    const vals: (string | number)[] = [
      sn,
      p.model || '',
      p.hs_code || '',
      p.size || '',
      p.name,
      p.material || '',
      p.country_of_origin || '',
      p.qty,
      p.unit,
      p.no_of_packages ?? 0,
      p.cbm != null ? +p.cbm.toFixed(3) : 0,
      p.nw  != null ? +p.nw.toFixed(2)  : 0,
      p.gw  != null ? +p.gw.toFixed(2)  : 0,
      ...(isCi ? [p.unit_price_foreign ?? 0, p.amount_foreign ?? 0] : []),
    ]

    vals.forEach((v, i) => {
      const isNumCol  = i >= 7 && i !== 8  // Qty(7), skip Unit(8), rest are numeric
      const isPrice   = i === 13 || i === 14
      styleCell(ws.getCell(colLetter(i + 1) + r), {
        value:   v,
        bgColor: bg,
        border:  thinBorder(),
        align:   i <= 1 || i === 4 || i === 5 ? 'left' : 'center',
        numFmt:  isPrice ? `"${sym}"#,##0.00` : isNumCol ? '#,##0.###' : undefined,
      })
    })
    r++
  }

  // ── Totals row ─────────────────────────────────────────────────────────────
  const totalQty  = dataRows.reduce((s, p) => s + (p.qty || 0), 0)
  const totalPkgs = opts.totalPackages ?? dataRows.reduce((s, p) => s + (p.no_of_packages || 0), 0)
  const totalCbm  = opts.totalCbm      ?? dataRows.reduce((s, p) => s + (p.cbm || 0), 0)
  const totalNw   = opts.totalNw       ?? dataRows.reduce((s, p) => s + (p.nw || 0), 0)
  const totalGw   = opts.totalGw       ?? dataRows.reduce((s, p) => s + (p.gw || 0), 0)
  const totalAmt  = opts.totalAmount   ?? dataRows.reduce((s, p) => s + (p.amount_foreign || 0), 0)

  ws.getRow(r).height = 18
  const totals: (string | number)[] = [
    'TOTAL', '', '', '', '', '', '',
    totalQty, '',
    totalPkgs,
    +totalCbm.toFixed(3),
    +totalNw.toFixed(2),
    +totalGw.toFixed(2),
    ...(isCi ? ['', +totalAmt.toFixed(2)] : []),
  ]

  totals.forEach((v, i) => {
    const isAmt = i === 14
    styleCell(ws.getCell(colLetter(i + 1) + r), {
      value:   v,
      bold:    true,
      bgColor: COLOR.totalsBg,
      border:  thickBottom(),
      align:   i === 0 ? 'center' : i <= 6 ? 'left' : 'center',
      numFmt:  isAmt ? `"${sym}"#,##0.00` : i >= 7 ? '#,##0.###' : undefined,
    })
  })
  r++

  // ── Amount in words (CI only) ──────────────────────────────────────────────
  if (isCi && totalAmt > 0) {
    const { amountInWordsEn } = await import('@/lib/amountInWords')
    ws.getRow(r).height = 14
    ws.mergeCells(`A${r}:${lastC}${r}`)
    styleCell(ws.getCell(`A${r}`), {
      value:   amountInWordsEn(totalAmt, currency),
      bold:    true,
      fontSize: 8,
      bgColor: 'FFfffdf0',
      border:  thinBorder('FFdddddd'),
      align:   'left',
    })
    r++
  }

  // ── Gap ────────────────────────────────────────────────────────────────────
  ws.getRow(r).height = 6
  r++

  // ── Bank info (CI only) ────────────────────────────────────────────────────
  if (isCi && (bankBeneficiary || bankName || bankSwift || bankAccount)) {
    ws.getRow(r).height = 14
    ws.mergeCells(`A${r}:${lastC}${r}`)
    styleCell(ws.getCell(`A${r}`), {
      value:   "SELLER'S BANK DETAILS",
      bold:    true,
      fontSize: 9,
      bgColor: COLOR.bankBg,
      border:  thinBorder(),
    })
    r++

    const bankLines: [string, string | undefined][] = [
      ['Beneficiary:', bankBeneficiary],
      ['Bank Name:', bankName],
      ['Bank Address:', bankAddress],
      ['SWIFT Code:', bankSwift],
      ['Account No.:', bankAccount],
    ]
    for (const [label, val] of bankLines) {
      if (!val) continue
      ws.getRow(r).height = 13
      ws.mergeCells(`A${r}:B${r}`)
      ws.mergeCells(`C${r}:${lastC}${r}`)
      styleCell(ws.getCell(`A${r}`), { value: label, bold: true, bgColor: COLOR.bankBg, border: thinBorder(), fontSize: 8.5, color: COLOR.labelColor })
      styleCell(ws.getCell(`C${r}`),  { value: val,   bgColor: COLOR.bankBg, border: thinBorder(), fontSize: 8.5 })
      r++
    }

    ws.getRow(r).height = 6
    r++
  }

  // ── Signature row (CI only) ────────────────────────────────────────────────
  if (isCi) {
    const mid = Math.floor(cols / 2)
    ws.getRow(r).height = 30
    ws.mergeCells(span(1, mid - 1, r))
    ws.mergeCells(span(mid + 1, cols, r))
    styleCell(ws.getCell(`A${r}`), {
      value: 'THE BUYER: _________________________',
      align: 'center', valign: 'bottom', fontSize: 9, color: COLOR.labelColor,
    })
    styleCell(ws.getCell(colLetter(mid + 1) + r), {
      value: 'THE SELLER: _________________________',
      align: 'center', valign: 'bottom', fontSize: 9, color: COLOR.labelColor,
    })
  }

  // ── Trigger browser download ───────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob   = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = `${documentNumber.replace(/[/\\?%*:|"<>]/g, '-')}-${mode}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
