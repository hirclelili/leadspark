import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
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
    fontFamily: 'Helvetica-Bold',
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
    fontFamily: 'Helvetica-Bold',
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
    fontFamily: 'Helvetica-Bold',
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
    fontFamily: 'Helvetica-Bold',
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
    width: 150,
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalLabel: {
    fontFamily: 'Helvetica-Bold',
  },
  totalValue: {
    fontFamily: 'Helvetica-Bold',
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
})

interface Product {
  name: string
  model?: string
  specs?: string
  qty: number
  unit: string
  unit_price_foreign: number
  amount_foreign: number
}

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
  type?: 'QUOTATION' | 'PI'
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
}: QuotationPDFProps) {
  const SYMBOL_MAP: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', AED: 'AED ', SGD: 'S$',
  }
  const currencySymbol = SYMBOL_MAP[currency] || currency + ' '

  const formatPrice = (price: number) => {
    return `${currencySymbol}${price.toFixed(2)}`
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companySection}>
            {logoUrl && (
              <Image src={logoUrl} style={{ width: 100, marginBottom: 10 }} />
            )}
            <Text style={styles.companyName}>{companyName}</Text>
            {companyNameCn && (
              <Text style={styles.companyInfo}>{companyNameCn}</Text>
            )}
            {address && <Text style={styles.companyInfo}>{address}</Text>}
            {phone && <Text style={styles.companyInfo}>Tel: {phone}</Text>}
            {email && <Text style={styles.companyInfo}>Email: {email}</Text>}
            {website && <Text style={styles.companyInfo}>Web: {website}</Text>}
          </View>
          <View style={styles.titleSection}>
            <Text style={styles.title}>
              {type === 'PI' ? 'PROFORMA INVOICE' : 'QUOTATION'}
            </Text>
            <Text style={styles.quoteNumber}>No: {quotationNumber}</Text>
          </View>
        </View>

        {/* Date Section */}
        <View style={styles.dateSection}>
          <View style={styles.row}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>{date}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Valid for:</Text>
            <Text style={styles.value}>{validityDays} days</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Trade Term:</Text>
            <Text style={styles.value}>{tradeTerm}</Text>
          </View>
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
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.itemCell]}>No.</Text>
            <Text style={[styles.tableHeaderCell, styles.descCell]}>
              Product / Description
            </Text>
            <Text style={[styles.tableHeaderCell, styles.qtyCell]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.priceCell]}>Unit Price</Text>
            <Text style={[styles.tableHeaderCell, styles.amountCell]}>Amount</Text>
          </View>
          {products.map((product, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.itemCell}>{index + 1}</Text>
              <Text style={styles.descCell}>
                {product.name}
                {product.model && ` (${product.model})`}
                {product.specs && `\n${product.specs}`}
              </Text>
              <Text style={styles.qtyCell}>
                {product.qty} {product.unit}
              </Text>
              <Text style={styles.priceCell}>
                {formatPrice(product.unit_price_foreign)}
              </Text>
              <Text style={styles.amountCell}>
                {formatPrice(product.amount_foreign)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
          </View>
        </View>

        {/* Payment Terms */}
        <View style={styles.row}>
          <Text style={styles.label}>Payment Terms:</Text>
          <Text style={styles.value}>{paymentTerms}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Delivery Time:</Text>
          <Text style={styles.value}>{deliveryTime}</Text>
        </View>
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
        {(bankName || bankAccount) && (
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

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.signature}>
            <Text style={styles.signatureLabel}>{companyName}</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureLabel}>Authorized Signature</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}