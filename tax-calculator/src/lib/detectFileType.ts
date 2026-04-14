/**
 * Detect whether extracted PDF text is a P&L report or an ADP payroll report.
 */
export function detectDocumentType(text: string): 'pl' | 'adp_payroll' | 'unknown' {
  // Log first 500 chars for debugging detection issues
  console.log('[detectDocumentType] First 500 chars:', text.slice(0, 500))

  // ── ADP / Payroll patterns (check first — more specific) ──

  // "Payroll Details" is the ADP Run report title
  if (/Payroll\s+Details/i.test(text) && /(FED\s+FIT|FED\s+SOCSEC|Regular|Pay\s+Period)/i.test(text)) {
    console.log('[detectDocumentType] → adp_payroll (Payroll Details)')
    return 'adp_payroll'
  }
  // ADP brand name + payroll keywords
  if (/ADP/i.test(text) && /(payroll|earnings|pay\s+statement|wage|worker|employee)/i.test(text)) {
    console.log('[detectDocumentType] → adp_payroll (ADP brand)')
    return 'adp_payroll'
  }
  // Payroll register reports
  if (/payroll\s+(register|summary|report)/i.test(text)) {
    console.log('[detectDocumentType] → adp_payroll (payroll register/summary)')
    return 'adp_payroll'
  }
  // Earnings statement
  if (/earnings\s+statement/i.test(text) && /(gross\s+pay|federal\s+income\s+tax|FIT)/i.test(text)) {
    console.log('[detectDocumentType] → adp_payroll (earnings statement)')
    return 'adp_payroll'
  }
  // Pay Period + tax withholding indicators
  if (/Pay\s+Period/i.test(text) && /(FED\s+FIT|federal|withholding|gross\s+pay|net\s+pay)/i.test(text)) {
    console.log('[detectDocumentType] → adp_payroll (Pay Period + tax)')
    return 'adp_payroll'
  }
  // Generic payroll indicators: tax withholding line items
  if (/(FED\s+FIT|FED\s+SOCSEC|FED\s+MED)/i.test(text) && /(gross|earnings|salary|wages|employee)/i.test(text)) {
    console.log('[detectDocumentType] → adp_payroll (FED tax lines)')
    return 'adp_payroll'
  }
  // Check/pay stub patterns
  if (/(pay\s+stub|check\s+date|pay\s+date|pay\s+period)/i.test(text) && /(gross|net\s+pay|federal|withholding|FICA|social\s+security|medicare)/i.test(text)) {
    console.log('[detectDocumentType] → adp_payroll (pay stub)')
    return 'adp_payroll'
  }
  // W-2 / wage summary
  if (/wages?\s*(,?\s*tips|paid)/i.test(text) && /(federal\s+income\s+tax|social\s+security|medicare)/i.test(text)) {
    console.log('[detectDocumentType] → adp_payroll (wage summary)')
    return 'adp_payroll'
  }
  // Broad: any document with YTD gross + tax withholding
  if (/YTD/i.test(text) && /(gross|earnings)/i.test(text) && /(federal|withholding|FIT|FICA)/i.test(text)) {
    console.log('[detectDocumentType] → adp_payroll (YTD gross + withholding)')
    return 'adp_payroll'
  }
  // Gusto, Paychex, or other payroll providers
  if (/(gusto|paychex|paylocity|paycom|paycor)/i.test(text) && /(payroll|earnings|pay\s+period|gross)/i.test(text)) {
    console.log('[detectDocumentType] → adp_payroll (other payroll provider)')
    return 'adp_payroll'
  }

  // ── P&L patterns ──
  if (/profit\s*(and|&)\s*loss/i.test(text)) return 'pl'
  if (/income\s+statement/i.test(text) && !/earnings\s+statement/i.test(text)) return 'pl'
  if (/P\s*&\s*L/i.test(text)) return 'pl'
  if (/net\s+income/i.test(text) && /total\s+(income|revenue|expenses?)/i.test(text)) return 'pl'
  if (/Monthly Report/i.test(text) && /net\s+income/i.test(text)) return 'pl'
  if (/total\s+revenue/i.test(text) && /total\s+expense/i.test(text)) return 'pl'

  console.warn('[detectDocumentType] → unknown (no patterns matched)')
  return 'unknown'
}

/**
 * Extract a 2–6 character client code from the beginning of a filename.
 * Handles formats like:
 *   "GBG 03-2026 Monthly Report.pdf"  → "GBG"
 *   "GBG_03-2026_Monthly_Report.pdf"  → "GBG"
 *   "GBG-03-2026.pdf"                 → "GBG"
 *   "GBGCO 03-2026.pdf"               → "GBGCO"
 */
export function extractClientCode(filename: string): string | null {
  // Remove file extension first
  const name = filename.replace(/\.[^.]+$/, '')
  // Match 2–6 alpha chars at start, followed by space, underscore, hyphen, or digit
  const match = name.match(/^([A-Za-z]{2,6})[\s_\-\d]/)
  return match ? match[1].toUpperCase() : null
}
