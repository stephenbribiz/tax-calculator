/**
 * Detect whether extracted PDF text is a P&L report or an ADP payroll report.
 */
export function detectDocumentType(text: string): 'pl' | 'adp_payroll' | 'unknown' {
  // ADP payroll patterns (check first — more specific)
  if (/ADP/i.test(text) && /(payroll|earnings|pay\s+statement|wage)/i.test(text)) {
    return 'adp_payroll'
  }
  if (/payroll\s+register/i.test(text)) {
    return 'adp_payroll'
  }
  if (/earnings\s+statement/i.test(text) && /(gross\s+pay|federal\s+income\s+tax|FIT)/i.test(text)) {
    return 'adp_payroll'
  }

  // P&L patterns
  if (/profit\s*(and|&)\s*loss/i.test(text)) return 'pl'
  if (/income\s+statement/i.test(text)) return 'pl'
  if (/P\s*&\s*L/i.test(text)) return 'pl'
  if (/net\s+income/i.test(text) && /total\s+(income|revenue|expenses?)/i.test(text)) return 'pl'
  if (/Monthly Report/i.test(text) && /net\s+income/i.test(text)) return 'pl'

  return 'unknown'
}

/**
 * Extract a 2–4 character client code from the beginning of a filename.
 * Expected format: "GBG 03-2026 Monthly Report.pdf" → "GBG"
 */
export function extractClientCode(filename: string): string | null {
  // Remove file extension first
  const name = filename.replace(/\.[^.]+$/, '')
  const match = name.match(/^([A-Za-z]{2,4})\s/)
  return match ? match[1].toUpperCase() : null
}
