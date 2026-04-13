import * as pdfjsLib from 'pdfjs-dist'

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

/**
 * Fields we can extract from a P&L statement
 */
export interface PLExtractedData {
  totalRevenue: number | null
  totalExpenses: number | null
  netIncome: number | null
  officerCompensation: number | null   // → shareholderSalary
  mealExpense: number | null           // → mealExpense
  shareholderDraw: number | null       // → shareholderDraw (distributions)
  rawText: string                      // full extracted text for debugging
}

/**
 * Extract text content from a PDF file
 */
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()

    // Group text items by their Y position to reconstruct lines
    const lineMap = new Map<number, { x: number; text: string }[]>()
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = Math.round((item as { transform: number[] }).transform[5])
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y)!.push({
        x: (item as { transform: number[] }).transform[4],
        text: item.str,
      })
    }

    // Sort lines by Y (descending = top to bottom) and items by X
    const sortedLines = Array.from(lineMap.entries())
      .sort(([a], [b]) => b - a)
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x)
          .map(i => i.text)
          .join('\t')
          .trim()
      )
      .filter(line => line.length > 0)

    pages.push(sortedLines.join('\n'))
  }

  return pages.join('\n\n--- Page Break ---\n\n')
}

/**
 * Parse a dollar amount from text, handling parentheses for negatives.
 * Matches: $1,234.56, $(1,234.56), (1,234.56), $1234, -$1,234.56, etc.
 */
function parseDollarAmount(text: string): number | null {
  const cleaned = text.trim()

  // Match amounts: $1,234.56 or $(1,234.56) or (1,234.56) or -1,234.56
  const match = cleaned.match(/\$?\(?\s*-?\s*([\d,]+(?:\.\d{1,2})?)\s*\)?/)
  if (!match) return null

  const numStr = match[1].replace(/,/g, '')
  const value = parseFloat(numStr)
  if (isNaN(value)) return null

  // Negative if wrapped in parens: ($541.70) or $(541.70)
  const isNegative = /\(.*\d.*\)/.test(cleaned) || cleaned.includes('-')
  return isNegative ? -value : value
}

/**
 * Extract the YTD (last/rightmost) dollar amount from a line.
 * AgilLink format: "Label \t monthly_amount \t ytd_amount"
 * QuickBooks format: "Label    amount"
 * preserveSign: if true, keeps negative values (for net income)
 */
function findYTDAmount(line: string, preserveSign = false): number | null {
  // Find all dollar amounts on the line
  const amounts = line.match(/\$?\(?\s*-?\s*[\d,]+(?:\.\d{1,2})?\s*\)?/g)
  if (!amounts || amounts.length === 0) return null

  // Take the LAST amount (YTD / rightmost column)
  const val = parseDollarAmount(amounts[amounts.length - 1])
  if (val === null) return null

  return preserveSign ? val : Math.abs(val)
}

/**
 * Find a dollar amount for a label, checking same line and next line.
 */
function findAmountForLabel(lines: string[], labelIndex: number, preserveSign = false): number | null {
  const val = findYTDAmount(lines[labelIndex], preserveSign)
  if (val !== null) return val

  // Check next line if current line has no amount
  if (labelIndex + 1 < lines.length) {
    return findYTDAmount(lines[labelIndex + 1], preserveSign)
  }

  return null
}

// Pattern groups for matching P&L line items
// Covers: QuickBooks, Xero, AgilLink, and common accounting formats
const PATTERNS = {
  netIncome: [
    /net\s+income\s*\/\s*\(?\s*loss\s*\)?/i,     // AgilLink: "Net Income / (Loss)"
    /net\s+(ordinary\s+)?income/i,
    /net\s+profit/i,
    /net\s+income\s*[/&]\s*loss/i,
    /net\s+income/i,
    /net\s+earnings/i,
    /profit\s*\(loss\)/i,
    /bottom\s+line/i,
  ],
  totalRevenue: [
    /^total\s+income\b/i,                          // AgilLink: "Total Income"
    /total\s+(revenue|sales)/i,
    /total\s+of\s+income/i,                         // AgilLink: "Total of Income From Operations"
    /gross\s+(income|revenue|receipts)/i,
  ],
  totalExpenses: [
    /^total\s+expenses?\b/i,                        // AgilLink: "Total Expenses"
    /total\s+operating\s+expenses?/i,
  ],
  officerCompensation: [
    /shareholder\s+salar/i,                         // AgilLink: "Shareholder Salary" or "Shareholder Salaries"
    /shareholder\s+comp/i,
    /officer\s*('s?)?\s+comp/i,
    /officer\s+salary/i,
    /owner\s*('s?)?\s+salary/i,
    /owner\s*('s?)?\s+comp/i,
    /owner\s*('s?)?\s+pay/i,
    /payroll\s+expense.*officer/i,
    /guaranteed\s+payments/i,
    /management\s+salary/i,
    /wages\s*[-–—]\s*officer/i,
  ],
  mealExpense: [
    /^food\s*[&,]\s*tips/i,                         // AgilLink: "Food & Tips"
    /meals?\s*(and|&|\/)\s*(entertainment|ent)/i,
    /meals?\s+expense/i,
    /business\s+meals?/i,
    /food\s*(and|&|\/)\s*bev/i,
    /^dining\b/i,
  ],
  shareholderDraw: [
    /shareholder\s+draw/i,
    /shareholder\s+dist/i,
    /owner\s*('s?)?\s+draw/i,
    /owner\s*('s?)?\s+dist/i,
    /distributions?\s+to\s+(owner|shareholder|member)/i,
    /member\s+draw/i,
    /member\s+dist/i,
  ],
}

/**
 * Detect if text is from AgilLink (has the characteristic header format)
 */
function isAgilLinkFormat(text: string): boolean {
  return /For the Month\s*\n\s*Ended/i.test(text) ||
    /Year to Date\s*\n\s*at/i.test(text) ||
    /Monthly Report/i.test(text)
}

/**
 * For AgilLink reports with multiple sections (main P&L + tour sub-reports),
 * extract only the main P&L section (everything before the first sub-report).
 * Sub-reports repeat the header pattern.
 */
function extractMainSection(text: string): string {
  const pageBreak = '--- Page Break ---'
  const pages = text.split(pageBreak)

  // Find where the main P&L ends by looking for "Net Income / (Loss)" on a page
  // The first occurrence of Net Income signals the end of the main P&L
  let mainText = ''
  let foundNetIncome = false

  for (const page of pages) {
    mainText += page + '\n'
    if (/net\s+income\s*\/\s*\(?\s*loss\s*\)?/i.test(page)) {
      foundNetIncome = true
      break
    }
  }

  // If we found net income, use just the main section
  // Otherwise fall back to full text
  return foundNetIncome ? mainText : text
}

/**
 * Parse P&L text and extract financial data
 */
function parseFinancialData(text: string): Omit<PLExtractedData, 'rawText'> {
  const isAgilLink = isAgilLinkFormat(text)

  // For AgilLink multi-section reports, only parse the main P&L
  const parseText = isAgilLink ? extractMainSection(text) : text

  const lines = parseText.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  const result: Omit<PLExtractedData, 'rawText'> = {
    totalRevenue: null,
    totalExpenses: null,
    netIncome: null,
    officerCompensation: null,
    mealExpense: null,
    shareholderDraw: null,
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip header lines, page footers, and date lines
    if (/^(For the Month|Ended|Year to Date|at\s+\d|Monthly Report|For the month)/i.test(line)) continue
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(line)) continue

    // Net income — take FIRST match in the main section (preserves negative sign)
    if (result.netIncome === null) {
      for (const pattern of PATTERNS.netIncome) {
        if (pattern.test(line)) {
          result.netIncome = findAmountForLabel(lines, i, true)
          break
        }
      }
    }

    // Total revenue — take first "Total Income" match
    if (result.totalRevenue === null) {
      for (const pattern of PATTERNS.totalRevenue) {
        if (pattern.test(line)) {
          result.totalRevenue = findAmountForLabel(lines, i)
          break
        }
      }
    }

    // Total expenses — take first match
    if (result.totalExpenses === null) {
      for (const pattern of PATTERNS.totalExpenses) {
        if (pattern.test(line)) {
          result.totalExpenses = findAmountForLabel(lines, i)
          break
        }
      }
    }

    // Officer / Shareholder compensation
    // For AgilLink with "Total:" prefix lines, prefer the Total line
    if (result.officerCompensation === null) {
      for (const pattern of PATTERNS.officerCompensation) {
        if (pattern.test(line)) {
          // If this is a "Total:" line or has amounts, grab it
          if (/^Total:/i.test(line) || findAmountForLabel(lines, i) !== null) {
            result.officerCompensation = findAmountForLabel(lines, i)
          }
          break
        }
      }
    }

    // Meal expense — accumulate (AgilLink "Food & Tips" or standard patterns)
    for (const pattern of PATTERNS.mealExpense) {
      if (pattern.test(line)) {
        const val = findAmountForLabel(lines, i)
        if (val !== null) {
          result.mealExpense = (result.mealExpense ?? 0) + val
        }
        break
      }
    }

    // Shareholder draw / distributions — take first match
    if (result.shareholderDraw === null) {
      for (const pattern of PATTERNS.shareholderDraw) {
        if (pattern.test(line)) {
          result.shareholderDraw = findAmountForLabel(lines, i)
          break
        }
      }
    }
  }

  return result
}

/**
 * Main entry point: parse a PDF P&L file and extract financial data
 */
export async function parsePLFromPDF(file: File): Promise<PLExtractedData> {
  const rawText = await extractTextFromPDF(file)
  const data = parseFinancialData(rawText)
  return { ...data, rawText }
}
