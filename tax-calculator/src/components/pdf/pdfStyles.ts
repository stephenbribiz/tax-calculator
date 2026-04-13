import { StyleSheet } from '@react-pdf/renderer'

export const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 40,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  headerLeft: {},
  reportTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    marginBottom: 2,
  },
  reportSubtitle: {
    fontSize: 10,
    color: '#64748b',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  clientName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },
  clientDetail: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },

  // Sections
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    backgroundColor: '#f1f5f9',
    padding: '5 8',
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },

  // Rows
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  rowLabel: {
    color: '#475569',
    fontSize: 9.5,
    flex: 1,
  },
  rowValue: {
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    fontSize: 9.5,
    textAlign: 'right',
  },
  rowLabelMuted: {
    color: '#94a3b8',
    fontSize: 9,
    flex: 1,
  },
  rowValueMuted: {
    color: '#94a3b8',
    fontSize: 9,
    textAlign: 'right',
  },

  // Summary / highlight rows
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: '#1e293b',
    marginTop: 4,
    borderRadius: 3,
  },
  totalLabel: {
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    fontSize: 11,
  },
  totalValue: {
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    fontSize: 13,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#eff6ff',
    marginTop: 2,
  },
  subtotalLabel: {
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    fontSize: 9.5,
  },
  subtotalValue: {
    fontFamily: 'Helvetica-Bold',
    color: '#1e40af',
    fontSize: 9.5,
  },

  // Warning box
  warningBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 3,
    padding: 8,
    marginBottom: 6,
  },
  warningText: {
    fontSize: 9,
    color: '#92400e',
  },

  // Notes
  noteText: {
    fontSize: 8.5,
    color: '#64748b',
    marginTop: 2,
    paddingHorizontal: 8,
  },

  // Disclaimer
  disclaimer: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  disclaimerText: {
    fontSize: 8,
    color: '#94a3b8',
    lineHeight: 1.5,
  },

  // Two-column layout
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
})
