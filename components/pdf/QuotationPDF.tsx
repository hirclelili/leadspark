import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer'
import { amountInWordsEn } from '@/lib/amountInWords'

// Register NotoSansSC for CJK support — loaded from Google Fonts CDN at render time.
// PDF generation runs in the browser, so the CDN fetch is cached after first use.
Font.register({
  family: 'NotoSansSC',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/notosanssc/v40/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYw.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/notosanssc/v40/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaGzjCnYw.ttf', fontWeight: 700 },
  ],
})

// Prevent font hyphenation for clean line-breaking
Font.registerHyphenationCallback((word) => [word])

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'NotoSansSC',
    fontWeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  companySection: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    marginBottom: 4,
  },
  companyInfo: {
    color: '#666',
    marginBottom: 2,
  },
  titleSection: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    marginBottom: 4,
  },
  quoteNumber: {
    fontSize: 10,
    color: '#666',
  },
  dateSection: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 80,
    color: '#666',
  },
  value: {
    flex: 1,
  },
  clientSection: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    marginBottom: 8,
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tableHeaderCell: {
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    fontSize: 9,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemCell: {
    width: 30,
    fontSize: 9,
  },
  descCell: {
    flex: 2,
    fontSize: 9,
  },
  qtyCell: {
    width: 50,
    fontSize: 9,
    textAlign: 'right',
  },
  priceCell: {
    width: 70,
    fontSize: 9,
    textAlign: 'right',
  },
  amountCell: {
    width: 70,
    fontSize: 9,
    textAlign: 'right',
  },
  totalsSection: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    width: 220,
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalRowWide: {
    flexDirection: 'row',
    width: 280,
    justifyContent: 'space-between',
    marginBottom: 4,
    alignSelf: 'flex-end',
  },
  totalLabel: {
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
  },
  totalValue: {
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
  },
  notesSection: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f9f9f9',
  },
  bankSection: {
    marginBottom: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  bankRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  bankLabel: {
    width: 100,
    fontSize: 9,
    color: '#666',
  },
  bankValue: {
    flex: 1,
    fontSize: 9,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 10,
  },
  signature: {
    flex: 1,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    marginBottom: 4,
    height: 30,
  },
  signatureLabel: {
    fontSize: 9,
    color: '#666',
  },
  amountWords: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f9f9f9',
    fontSize: 9,
    color: '#333',
  },
  containerHeaderRow: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#ececec',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  containerHeaderText: {
    fontSize: 10,
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    flex: 1,
  },
  subtotalRow: {
    flexDirection: 'row',
    padding: 6,
    paddingLeft: 38,
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    justifyContent: 'flex-end',
    gap: 12,
  },
  subtotalLabel: {
    fontSize: 9,
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    color: '#444',
  },
  subtotalValue: {
    fontSize: 9,
    fontFamily: 'NotoSansSC',
    fontWeight: 700,
    width: 70,
    textAlign: 'right',
  },
  dualSignRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 24,
    marginTop: 8,
  },
})

export type QuoteLayoutMode = 'product_list' | 'container_group'

interface Product {
  name: string
  model?: string
  specs?: string
  qty: number
  unit: string
  unit_price_foreign: number
  amount_foreign: number
  /** Packing / section title row (no qty or price). */
  is_container_header?: boolean
}

export type DocumentKind = 'QUOTATION' | 'PI' | 'CI' | 'PL'

interface QuotationPDFProps {
  companyName: string
  companyNameCn?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  logoUrl?: string
  bankName?: string
  bankAccount?: string
  bankSwift?: string
  bankBeneficiary?: string
  clientName: string
  clientContact?: string
  clientAddress?: string
  quotationNumber: string
  date: string
  validityDays: number
  tradeTerm: string
  currency: string
  products: Product[]
  totalAmount: number
  paymentTerms: string
  deliveryTime: string
  packing?: string
  remarks?: string
  /** @deprecated use documentKind */
  type?: 'QUOTATION' | 'PI'
  documentKind?: DocumentKind
  /** Packing list vs container sections (subtotals in PDF when grouped). */
  quoteMode?: QuoteLayoutMode
  /** When false, hide seller logo, name, and address (PL/PI 中间商场景). */
  showSellerHeader?: boolean
  /** Shown as document “No.” — use custom PI/CI reference or fallback to quotationNumber. */
  documentNumberDisplay?: string
  /** Buyer’s PO (shown on PI when set). */
  poNumber?: string
  /** Deposit % for PI (0–100). */
  depositPercent?: number
  /** Optional subtotals shown above the main Total (e.g. EXW vs logistics term). */
  quoteSummaryLines?: { label: string; amountForeign: number }[]
}

export function QuotationPDF({
  companyName,
  companyNameCn,
  address,
  phone,
  email,
  website,
  logoUrl,
  bankName,
  bankAccount,
  bankSwift,
  bankBeneficiary,
  clientName,
  clientContact,
  clientAddress,
  quotationNumber,
  date,
  validityDays,
  tradeTerm,
  currency,
  products,
  totalAmount,
  paymentTerms,
  deliveryTime,
  packing,
  remarks,
  type = 'QUOTATION',
  documentKind: documentKindProp,
  quoteMode = 'product_list',
  showSellerHeader = true,
  documentNumberDisplay,
  poNumber,
  depositPercent = 0,
  quoteSummaryLines,
}: QuotationPDFProps) {
  const documentKind: DocumentKind =
    documentKindProp ?? (type === 'PI' ? 'PI' : 'QUOTATION')

  const titleForKind: Record<DocumentKind, string> = {
    QUOTATION: 'QUOTATION',
    PL: 'PACKING LIST',
    PI: 'PROFORMA INVOICE',
    CI: 'COMMERCIAL INVOICE',
  }

  const noLine = documentNumberDisplay?.trim() || quotationNumber

  const SYMBOL_MAP: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    AED: 'AED ',
    SGD: 'S$',
    CNY: '¥',
    HKD: 'HK$',
  }
  const currencySymbol = SYMBOL_MAP[currency] || `${currency} `

  const formatPrice = (price: number) => {
    return `${currencySymbol}${price.toFixed(2)}`
  }

  const isPackingList = documentKind === 'PL'
  const isPi = documentKind === 'PI'
  const isQuotation = documentKind === 'QUOTATION'
  const showPricing = isPi || documentKind === 'CI' || isQuotation
  /** PI: always show bank when present; Quotation: keep template light (no bank block). */
  const showBank =
    (bankName || bankAccount) &&
    (isPi || documentKind === 'CI') &&
    !isQuotation

  const sigBlock = showSellerHeader ? companyName : 'Seller'

  const depositPct = Math.min(100, Math.max(0, Number(depositPercent) || 0))
  const depositAmount =
    isPi && depositPct > 0 ? (totalAmount * depositPct) / 100 : 0
  const balanceAfterDeposit = totalAmount - depositAmount

  const isContainerMode = quoteMode === 'container_group'

  /** Build rendering slices: flat rows, or grouped with subtotal lines inserted. */
  type PricedSlice =
    | { kind: 'header'; title: string }
    | { kind: 'product'; product: Product; lineNo: number }
    | { kind: 'subtotal'; amount: number }

  type PlSlice = { kind: 'header'; title: string } | { kind: 'product'; product: Product; lineNo: number }

  function buildPricedSlices(prods: Product[]): PricedSlice[] {
    if (!isContainerMode) {
      let n = 0
      const out: PricedSlice[] = []
      for (const product of prods) {
        if (product.is_container_header) {
          out.push({ kind: 'header', title: product.name })
          continue
        }
        n += 1
        out.push({ kind: 'product', product, lineNo: n })
      }
      return out
    }
    const groups: { header?: string; items: Product[] }[] = []
    let cur: { header?: string; items: Product[] } = { items: [] }
    for (const p of prods) {
      if (p.is_container_header) {
        if (cur.items.length > 0 || cur.header) {
          groups.push(cur)
        }
        cur = { header: p.name, items: [] }
      } else {
        cur.items.push(p)
      }
    }
    if (cur.items.length > 0 || cur.header) groups.push(cur)

    const slices: PricedSlice[] = []
    let lineNo = 0
    for (const g of groups) {
      if (g.header) {
        slices.push({ kind: 'header', title: g.header })
      }
      for (const product of g.items) {
        lineNo += 1
        slices.push({ kind: 'product', product, lineNo })
      }
      if (g.items.length > 0) {
        const sub = g.items.reduce((s, x) => s + (x.amount_foreign || 0), 0)
        slices.push({ kind: 'subtotal', amount: sub })
      }
    }
    return slices
  }

  function buildPlSlices(prods: Product[]): PlSlice[] {
    if (!isContainerMode) {
      let n = 0
      const out: PlSlice[] = []
      for (const product of prods) {
        if (product.is_container_header) {
          out.push({ kind: 'header', title: product.name })
          continue
        }
        n += 1
        out.push({ kind: 'product', product, lineNo: n })
      }
      return out
    }
    const groups: { header?: string; items: Product[] }[] = []
    let cur: { header?: string; items: Product[] } = { items: [] }
    for (const p of prods) {
      if (p.is_container_header) {
        if (cur.items.length > 0 || cur.header) {
          groups.push(cur)
        }
        cur = { header: p.name, items: [] }
      } else {
        cur.items.push(p)
      }
    }
    if (cur.items.length > 0 || cur.header) groups.push(cur)

    const slices: PlSlice[] = []
    let lineNo = 0
    for (const g of groups) {
      if (g.header) {
        slices.push({ kind: 'header', title: g.header })
      }
      for (const product of g.items) {
        lineNo += 1
        slices.push({ kind: 'product', product, lineNo })
      }
    }
    return slices
  }

  const pricedSlices = showPricing && !isPackingList ? buildPricedSlices(products) : []
  const plSlices = isPackingList ? buildPlSlices(products) : []

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companySection}>
            {showSellerHeader && logoUrl && (
              <Image src={logoUrl} style={{ width: 100, marginBottom: 10 }} />
            )}
            {showSellerHeader && (
              <>
                <Text style={styles.companyName}>{companyName}</Text>
                {companyNameCn && (
                  <Text style={styles.companyInfo}>{companyNameCn}</Text>
                )}
                {address && <Text style={styles.companyInfo}>{address}</Text>}
                {phone && <Text style={styles.companyInfo}>Tel: {phone}</Text>}
                {email && <Text style={styles.companyInfo}>Email: {email}</Text>}
                {website && <Text style={styles.companyInfo}>Web: {website}</Text>}
              </>
            )}
          </View>
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              {titleForKind[documentKind] ?? 'QUOTATION'}
            </Text>
            <Text style={styles.quoteNumber}>No: {noLine}</Text>
          </View>
        </View>

        {/* Date Section */}
        <View style={styles.dateSection}>
          <View style={styles.row}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>{date}</Text>
          </View>
          {!isPackingList && (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Valid for:</Text>
                <Text style={styles.value}>{validityDays} days</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Trade Term:</Text>
                <Text style={styles.value}>{tradeTerm}</Text>
              </View>
              {isPi && poNumber?.trim() ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Buyer&apos;s PO:</Text>
                  <Text style={styles.value}>{poNumber.trim()}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* Client Section */}
        <View style={styles.clientSection}>
          <Text style={styles.sectionTitle}>To:</Text>
          <Text>{clientName}</Text>
          {clientContact && <Text>{clientContact}</Text>}
          {clientAddress && <Text>{clientAddress}</Text>}
        </View>

        {/* Products Table */}
        <View style={styles.table}>
          {isPackingList ? (
            <>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.itemCell]}>No.</Text>
                <Text style={[styles.tableHeaderCell, styles.descCell]}>
                  Description
                </Text>
                <Text style={[styles.tableHeaderCell, styles.qtyCell]}>Qty</Text>
                <Text style={[styles.tableHeaderCell, { width: 50, fontSize: 9, fontFamily: 'NotoSansSC', fontWeight: 700 }]}>Unit</Text>
              </View>
              {plSlices.map((slice, index) =>
                slice.kind === 'header' ? (
                  <View key={`pl-h-${index}`} style={styles.containerHeaderRow}>
                    <Text style={styles.containerHeaderText}>{slice.title}</Text>
                  </View>
                ) : (
                  <View key={`pl-p-${index}`} style={styles.tableRow}>
                    <Text style={styles.itemCell}>{slice.lineNo}</Text>
                    <Text style={styles.descCell}>
                      {slice.product.name}
                      {slice.product.model && ` (${slice.product.model})`}
                      {slice.product.specs && `\n${slice.product.specs}`}
                    </Text>
                    <Text style={styles.qtyCell}>{slice.product.qty}</Text>
                    <Text style={{ width: 50, fontSize: 9 }}>{slice.product.unit}</Text>
                  </View>
                )
              )}
            </>
          ) : (
            <>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.itemCell]}>No.</Text>
                <Text style={[styles.tableHeaderCell, styles.descCell]}>
                  Product / Description
                </Text>
                <Text style={[styles.tableHeaderCell, styles.qtyCell]}>Qty</Text>
                <Text style={[styles.tableHeaderCell, styles.priceCell]}>Unit Price</Text>
                <Text style={[styles.tableHeaderCell, styles.amountCell]}>Amount</Text>
              </View>
              {pricedSlices.map((slice, index) =>
                slice.kind === 'header' ? (
                  <View key={`pr-h-${index}`} style={styles.containerHeaderRow}>
                    <Text style={styles.containerHeaderText}>{slice.title}</Text>
                  </View>
                ) : slice.kind === 'subtotal' ? (
                  <View key={`pr-s-${index}`} style={[styles.tableRow, { backgroundColor: '#fafafa' }]}>
                    <Text style={styles.itemCell} />
                    <Text style={[styles.descCell, { fontFamily: 'NotoSansSC', fontWeight: 700 }]}>Subtotal</Text>
                    <Text style={styles.qtyCell} />
                    <Text style={styles.priceCell} />
                    <Text style={[styles.amountCell, { fontFamily: 'NotoSansSC', fontWeight: 700 }]}>
                      {formatPrice(slice.amount)}
                    </Text>
                  </View>
                ) : (
                  <View key={`pr-p-${index}`} style={styles.tableRow}>
                    <Text style={styles.itemCell}>{slice.lineNo}</Text>
                    <Text style={styles.descCell}>
                      {slice.product.name}
                      {slice.product.model && ` (${slice.product.model})`}
                      {slice.product.specs && `\n${slice.product.specs}`}
                    </Text>
                    <Text style={styles.qtyCell}>
                      {slice.product.qty} {slice.product.unit}
                    </Text>
                    <Text style={styles.priceCell}>
                      {formatPrice(slice.product.unit_price_foreign)}
                    </Text>
                    <Text style={styles.amountCell}>
                      {formatPrice(slice.product.amount_foreign)}
                    </Text>
                  </View>
                )
              )}
            </>
          )}
        </View>

        {/* Totals */}
        {showPricing && (
          <View style={styles.totalsSection}>
            {quoteSummaryLines && quoteSummaryLines.length > 0 ? (
              <>
                {quoteSummaryLines.map((line, i) => (
                  <View key={i} style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{line.label}:</Text>
                    <Text style={styles.totalValue}>{formatPrice(line.amountForeign)}</Text>
                  </View>
                ))}
              </>
            ) : null}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
            </View>
            {isPi && depositPct > 0 ? (
              <>
                <View style={styles.totalRowWide}>
                  <Text style={styles.totalLabel}>
                    Deposit ({depositPct}%):
                  </Text>
                  <Text style={styles.totalValue}>{formatPrice(depositAmount)}</Text>
                </View>
                <View style={styles.totalRowWide}>
                  <Text style={styles.totalLabel}>Balance (after deposit):</Text>
                  <Text style={styles.totalValue}>
                    {formatPrice(balanceAfterDeposit)}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        )}

        {isPi && showPricing ? (
          <View style={styles.amountWords}>
            <Text>{amountInWordsEn(totalAmount, currency)}</Text>
          </View>
        ) : null}

        {/* Payment Terms */}
        {!isPackingList && (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>Payment Terms:</Text>
              <Text style={styles.value}>{paymentTerms}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Delivery Time:</Text>
              <Text style={styles.value}>{deliveryTime}</Text>
            </View>
          </>
        )}
        {packing && (
          <View style={styles.row}>
            <Text style={styles.label}>Packing:</Text>
            <Text style={styles.value}>{packing}</Text>
          </View>
        )}

        {/* Remarks */}
        {remarks && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>Remarks:</Text>
            <Text>{remarks}</Text>
          </View>
        )}

        {/* Bank Info */}
        {showBank && (
          <View style={styles.bankSection}>
            <Text style={[styles.sectionTitle, { fontSize: 10, marginBottom: 6 }]}>
              Banking Information:
            </Text>
            {bankBeneficiary && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Beneficiary:</Text>
                <Text style={styles.bankValue}>{bankBeneficiary}</Text>
              </View>
            )}
            {bankName && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Bank Name:</Text>
                <Text style={styles.bankValue}>{bankName}</Text>
              </View>
            )}
            {bankAccount && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Account No.:</Text>
                <Text style={styles.bankValue}>{bankAccount}</Text>
              </View>
            )}
            {bankSwift && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>SWIFT/BIC:</Text>
                <Text style={styles.bankValue}>{bankSwift}</Text>
              </View>
            )}
          </View>
        )}

        {/* Footer / signatures */}
        <View style={styles.footer}>
          {isPi ? (
            <View style={styles.dualSignRow}>
              <View style={[styles.signature, { flex: 1 }]}>
                <Text style={styles.signatureLabel}>Buyer</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>Authorized Signature</Text>
              </View>
              <View style={[styles.signature, { flex: 1 }]}>
                <Text style={styles.signatureLabel}>{sigBlock}</Text>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>Authorized Signature</Text>
              </View>
            </View>
          ) : (
            <View style={styles.signature}>
              <Text style={styles.signatureLabel}>{sigBlock}</Text>
              <View style={styles.signatureLine} />
              <Text style={styles.signatureLabel}>Authorized Signature</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}