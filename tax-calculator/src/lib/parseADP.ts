import { extractTextFromPDF, findYTDAmount, parseDollarAmount } from '@/lib/pdfUtils'

/**
 * Fields extracted from an ADP Payroll Details report
 */
export interface ADPExtractedData {
  employeeName: string | null
  ytdGrossWages: number | null         // Regular W-2 salary only (NOT draws/distributions) → shareholderSalary
  ytdFederalWithholding: number | null  // FED FIT → federalWithholding
  ytdStateWithholding: number | null
  payPeriod: string | null             // e.g. "01/01/2026 to 03/31/2026"
  rawText: string
}

/**
 * Parse ADP Payroll Details text and extract payroll data.
 *
 * ADP "Payroll Details" format (Run / small business):
 *   - Title: "Payroll Details"
 *   - Employee: Lastname, Firstname M   SSN: xxx-xx-####
 *   - Earnings rows: "Regular  0.00  32,915.70"
 *   - Distributions: "Draw NT  0.00  20,000.00"  ← NOT salary, skip
 *   - Tax rows: "FED FIT  7,399.26"
 *   - Pay Period: "Pay Period from: MM/DD/YYYY to: MM/DD/YYYY"
 *
 * The table columns are tab-separated at the same Y position, so a single
 * "line" may look like:
 *   "Regular\t0.00\t32,915.70\tFED FIT\t7,399.26\t\t42,998.39\tFED SOCSEC-ER\t2,040.78"
 */
function parsePayrollData(text: string): Omit<ADPExtractedData, 'rawText'> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  const result: Omit<ADPExtractedData, 'rawText'> = {
    employeeName: null,
    ytdGrossWages: null,
    ytdFederalWithholding: null,
    ytdStateWithholding: null,
    payPeriod: null,
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // ── Employee name ──
    // Format: "Employee: Craft, Evan K   SSN: xxx-xx-4542"
    if (result.employeeName === null && /Employee:/i.test(line)) {
      const nameMatch = line.match(/Employee:\s+([A-Za-z][A-Za-z,.\s'-]+?)(?:\s{2,}|SSN:|$)/i)
      if (nameMatch) {
        // ADP uses "Lastname, Firstname" — reverse to "Firstname Lastname"
        const raw = nameMatch[1].trim()
        const parts = raw.split(',').map(p => p.trim())
        result.employeeName = parts.length === 2 ? `${parts[1]} ${parts[0]}` : raw
      }
    }

    // ── Pay period ──
    // Format: "Pay Period from: 01/01/2026 to: 03/31/2026"
    if (result.payPeriod === null && /Pay Period from:/i.test(line)) {
      const ppMatch = line.match(/Pay Period from:\s*([\d/]+)\s+to:\s*([\d/]+)/i)
      if (ppMatch) {
        result.payPeriod = `${ppMatch[1]} to ${ppMatch[2]}`
      }
    }

    // ── Regular W-2 salary ──
    // "Regular" at start of token (NOT "Draw NT" which is a distribution)
    // The line may contain multiple columns tab-separated
    // Look for "Regular" but NOT lines that are sub-totals or company totals headers
    if (result.ytdGrossWages === null && /\bRegular\b/i.test(line)) {
      // Skip header rows and total label rows
      if (/^(description|total|company)/i.test(line)) continue

      // The "Regular" amount is in the earnings Amount column (3rd column or last numeric before tax columns)
      // Try to parse the first meaningful dollar amount after "Regular" on this line
      // Format: "Regular\t0.00\t32,915.70\t..." or just "Regular  0.00  32,915.70"
      const val = extractRegularAmount(line)
      if (val !== null) result.ytdGrossWages = val
    }

    // ── FED FIT (Federal Income Tax withheld) ──
    if (result.ytdFederalWithholding === null && /\bFED\s+FIT\b/i.test(line)) {
      // "FED FIT" followed by amount on same line
      // e.g. "Regular\t0.00\t32,915.70\tFED FIT\t7,399.26\t..."
      // Find amount right after "FED FIT" text
      const val = extractAmountAfterLabel(line, /FED\s+FIT/i)
      if (val !== null) result.ytdFederalWithholding = val
      else {
        // Check next line
        const nextVal = findYTDAmount(lines[i + 1] ?? '')
        if (nextVal !== null) result.ytdFederalWithholding = nextVal
      }
    }

    // ── State income tax ──
    // TN has no income tax; CA/NY etc. would show "CA SIT" or "NY SIT"
    if (result.ytdStateWithholding === null && /\b[A-Z]{2}\s+SIT\b/i.test(line)) {
      const val = extractAmountAfterLabel(line, /[A-Z]{2}\s+SIT/i)
      if (val !== null) result.ytdStateWithholding = val
    }
  }

  // ── Fallback: look in "Pay Frequency Totals" or "Company Totals" section ──
  // These repeat the same numbers and are a reliable source if row-level parsing missed
  if (result.ytdGrossWages === null || result.ytdFederalWithholding === null) {
    parseTotalsSection(lines, result)
  }

  return result
}

/**
 * Extract the earnings "Amount" column value from a "Regular" line.
 * ADP format has: Description | Hours | Rate | Amount | ...
 * Tab-separated, so Amount is typically the 4th token (index 3) if Hours and Rate are present,
 * or the 3rd token (index 2) if Rate is omitted.
 * We want the first non-zero number that is NOT a small hours count.
 */
function extractRegularAmount(line: string): number | null {
  // Split by tabs or multiple spaces
  const tokens = line.split(/\t|\s{2,}/).map(t => t.trim()).filter(t => t.length > 0)

  // Find "Regular" token index
  const regularIdx = tokens.findIndex(t => /^Regular$/i.test(t))
  if (regularIdx === -1) return null

  // Look at subsequent tokens for a dollar amount (>100 to distinguish from hours/rate)
  for (let j = regularIdx + 1; j < Math.min(tokens.length, regularIdx + 5); j++) {
    const val = parseDollarAmount(tokens[j])
    if (val !== null && val > 100) return val  // hours/rate are typically small numbers
  }

  return null
}

/**
 * Extract the dollar amount immediately following a label pattern within a line.
 */
function extractAmountAfterLabel(line: string, labelPattern: RegExp): number | null {
  const match = line.match(labelPattern)
  if (!match) return null

  // Get text after the label match
  const afterLabel = line.slice(match.index! + match[0].length)

  // Split by tabs or whitespace and find first number
  const tokens = afterLabel.split(/\t|\s+/).map(t => t.trim()).filter(t => t.length > 0)
  for (const token of tokens) {
    const val = parseDollarAmount(token)
    if (val !== null) return val
  }

  return null
}

/**
 * Secondary pass: look for totals sections and re-extract if needed.
 * ADP reports have "Pay Frequency Totals:" and "Company Totals:" sections
 * that repeat the same numbers with $ prefixes.
 */
function parseTotalsSection(
  lines: string[],
  result: Omit<ADPExtractedData, 'rawText'>
): void {
  let inTotals = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/Pay Frequency Totals|Company Totals/i.test(line)) {
      inTotals = true
      continue
    }

    if (!inTotals) continue

    // Stop at next major section
    if (/Total Employees/i.test(line)) {
      inTotals = false
      continue
    }

    // Regular salary in totals section (amounts shown with $ signs)
    if (result.ytdGrossWages === null && /\bRegular\b/i.test(line)) {
      const val = extractRegularAmount(line)
      if (val !== null) result.ytdGrossWages = val
    }

    // FED FIT in totals section
    if (result.ytdFederalWithholding === null && /\bFED\s+FIT\b/i.test(line)) {
      const val = extractAmountAfterLabel(line, /FED\s+FIT/i)
      if (val !== null) result.ytdFederalWithholding = val
    }

    // State income tax
    if (result.ytdStateWithholding === null && /\b[A-Z]{2}\s+SIT\b/i.test(line)) {
      const val = extractAmountAfterLabel(line, /[A-Z]{2}\s+SIT/i)
      if (val !== null) result.ytdStateWithholding = val
    }
  }
}

/**
 * Main entry point: parse an ADP Payroll Details PDF and extract payroll data.
 *
 * Key mappings:
 *   ytdGrossWages        → shareholderSalary  (W-2 Regular wages only)
 *   ytdFederalWithholding → federalWithholding (FED FIT)
 */
export async function parseADPFromPDF(file: File): Promise<ADPExtractedData> {
  const rawText = await extractTextFromPDF(file)
  const data = parsePayrollData(rawText)
  return { ...data, rawText }
}
