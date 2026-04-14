import { extractTextFromPDF, findYTDAmount } from '@/lib/pdfUtils'

/**
 * Fields extracted from an ADP payroll report
 */
export interface ADPExtractedData {
  employeeName: string | null
  ytdGrossWages: number | null         // → shareholderSalary
  ytdFederalWithholding: number | null  // → federalWithholding
  ytdStateWithholding: number | null
  rawText: string
}

// Pattern groups for ADP payroll line items
const PATTERNS = {
  grossPay: [
    /total\s+gross/i,
    /gross\s+pay/i,
    /gross\s+earnings/i,
    /total\s+earnings/i,
    /gross\s+wages/i,
  ],
  federalWithholding: [
    /federal\s+income\s+tax/i,
    /fed\s+income\s+tax/i,
    /fed\s+inc\s+tax/i,
    /^FIT\b/i,
    /federal\s+tax\s+withheld/i,
    /federal\s+withholding/i,
  ],
  stateWithholding: [
    /state\s+income\s+tax/i,
    /state\s+tax\s+withheld/i,
    /state\s+withholding/i,
    /^SIT\b/i,
  ],
}

/**
 * Parse ADP payroll report text and extract payroll data
 */
function parsePayrollData(text: string): Omit<ADPExtractedData, 'rawText'> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  const result: Omit<ADPExtractedData, 'rawText'> = {
    employeeName: null,
    ytdGrossWages: null,
    ytdFederalWithholding: null,
    ytdStateWithholding: null,
  }

  // Try to find employee name from early lines
  // ADP usually puts the employee name near the top
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i]
    // Skip header/company/date lines
    if (/^(ADP|payroll|earnings|pay\s+(date|period|statement)|check\s+date|company|employer)/i.test(line)) continue
    if (/^\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}/.test(line)) continue
    if (/^(page|printed|report)/i.test(line)) continue

    // A name-like line: 2-4 words, mostly letters
    const words = line.split(/\s+/).filter(w => /^[A-Za-z.,'-]+$/.test(w))
    if (words.length >= 2 && words.length <= 4 && line.length < 50) {
      result.employeeName = line
      break
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Gross pay / total gross
    if (result.ytdGrossWages === null) {
      for (const pattern of PATTERNS.grossPay) {
        if (pattern.test(line)) {
          const val = findAmountForLabel(lines, i)
          if (val !== null) result.ytdGrossWages = val
          break
        }
      }
    }

    // Federal income tax withholding
    if (result.ytdFederalWithholding === null) {
      for (const pattern of PATTERNS.federalWithholding) {
        if (pattern.test(line)) {
          const val = findAmountForLabel(lines, i)
          if (val !== null) result.ytdFederalWithholding = val
          break
        }
      }
    }

    // State income tax withholding
    if (result.ytdStateWithholding === null) {
      for (const pattern of PATTERNS.stateWithholding) {
        if (pattern.test(line)) {
          const val = findAmountForLabel(lines, i)
          if (val !== null) result.ytdStateWithholding = val
          break
        }
      }
    }
  }

  return result
}

/**
 * Find a dollar amount for a label, checking same line and nearby lines.
 */
function findAmountForLabel(lines: string[], labelIndex: number): number | null {
  const val = findYTDAmount(lines[labelIndex])
  if (val !== null) return val

  // Check next 2 lines
  for (let offset = 1; offset <= 2; offset++) {
    if (labelIndex + offset < lines.length) {
      const nextVal = findYTDAmount(lines[labelIndex + offset])
      if (nextVal !== null) return nextVal
    }
  }

  return null
}

/**
 * Main entry point: parse an ADP payroll PDF and extract payroll data
 */
export async function parseADPFromPDF(file: File): Promise<ADPExtractedData> {
  const rawText = await extractTextFromPDF(file)
  const data = parsePayrollData(rawText)
  return { ...data, rawText }
}
