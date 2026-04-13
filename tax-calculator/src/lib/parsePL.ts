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
          .join('  ')
          .trim()
      )
      .filter(line => line.length > 0)

    pages.push(sortedLines.join('\n'))
  }

  return pages.join('\n\n--- Page Break ---\n\n')
}

/**
 * Parse a dollar amount from text, handling parentheses for negatives
 * Matches: $1,234.56, (1,234.56), $1234, -$1,234.56, etc.
 */
function parseDollarAmount(text: string): number | null {
  // Clean the text
  const cleaned = text.trim()

  // Match amounts with optional $ and commas: $1,234.56 or (1,234.56) or -1234
  const match = cleaned.match(/\(?\$?\s*-?\s*([\d,]+(?:\.\d{1,2})?)\)?/)
  if (!match) return null

  const numStr = match[1].replace(/,/g, '')
  const value = parseFloat(numStr)
  if (isNaN(value)) return null

  // Negative if wrapped in parens
  const isNegative = cleaned.includes('(') && cleaned.includes(')')
  return isNegative ? -value : value
}

/**
 * Find a dollar amount on the same line as a label, or on the next line
 */
function findAmountForLabel(lines: string[], labelIndex: number): number | null {
  const line = lines[labelIndex]

  // Look for dollar amounts on the same line (usually right-aligned)
  // Split the line and look for the rightmost dollar amount
  const amounts = line.match(/\(?\$?\s*-?\s*[\d,]+(?:\.\d{1,2})?\)?/g)
  if (amounts && amounts.length > 0) {
    // Take the last amount on the line (right-most column = this period's total)
    const val = parseDollarAmount(amounts[amounts.length - 1])
    if (val !== null) return Math.abs(val)
  }

  // Check next line if current line has no amount
  if (labelIndex + 1 < lines.length) {
    const nextLine = lines[labelIndex + 1]
    const nextAmounts = nextLine.match(/\(?\$?\s*-?\s*[\d,]+(?:\.\d{1,2})?\)?/g)
    if (nextAmounts && nextAmounts.length > 0) {
      const val = parseDollarAmount(nextAmounts[nextAmounts.length - 1])
      if (val !== null) return Math.abs(val)
    }
  }

  return null
}

// Pattern groups for matching P&L line items
// Each group has multiple patterns to handle different accounting software formats
const PATTERNS = {
  netIncome: [
    /net\s+(ordinary\s+)?income/i,
    /net\s+profit/i,
    /net\s+income\s*\/?\s*loss/i,
    /net\s+income/i,
    /net\s+earnings/i,
    /bottom\s+line/i,
    /profit\s+\(loss\)/i,
  ],
  totalRevenue: [
    /total\s+(income|revenue|sales)/i,
    /gross\s+(income|revenue|receipts)/i,
    /total\s+gross\s+income/i,
  ],
  totalExpenses: [
    /total\s+expenses?/i,
    /total\s+operating\s+expenses?/i,
  ],
  officerCompensation: [
    /officer\s*('s?)?\s+comp/i,
    /shareholder\s+salary/i,
    /shareholder\s+comp/i,
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
    /meals?\s*(and|&|\/)\s*(entertainment|ent)/i,
    /meals?\s+expense/i,
    /business\s+meals?/i,
    /food\s*(and|&|\/)\s*bev/i,
    /dining/i,
    /restaurant/i,
  ],
  shareholderDraw: [
    /shareholder\s+draw/i,
    /shareholder\s+dist/i,
    /owner\s*('s?)?\s+draw/i,
    /owner\s*('s?)?\s+dist/i,
    /distributions?\s+to\s+(owner|shareholder)/i,
    /member\s+draw/i,
    /member\s+dist/i,
  ],
}

/**
 * Parse P&L text and extract financial data
 */
function parseFinancialData(text: string): Omit<PLExtractedData, 'rawText'> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  const result: Omit<PLExtractedData, 'rawText'> = {
    totalRevenue: null,
    totalExpenses: null,
    netIncome: null,
    officerCompensation: null,
    mealExpense: null,
    shareholderDraw: null,
  }

  // For net income, we want the LAST match (most likely the final bottom line)
  let lastNetIncomeIdx = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Net income — track last occurrence
    for (const pattern of PATTERNS.netIncome) {
      if (pattern.test(line)) {
        lastNetIncomeIdx = i
        break
      }
    }

    // Total revenue — take first match
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

    // Officer compensation — take first match
    if (result.officerCompensation === null) {
      for (const pattern of PATTERNS.officerCompensation) {
        if (pattern.test(line)) {
          result.officerCompensation = findAmountForLabel(lines, i)
          break
        }
      }
    }

    // Meal expense — accumulate if multiple matches
    for (const pattern of PATTERNS.mealExpense) {
      if (pattern.test(line)) {
        const val = findAmountForLabel(lines, i)
        if (val !== null) {
          result.mealExpense = (result.mealExpense ?? 0) + val
        }
        break
      }
    }

    // Shareholder draw — take first match
    if (result.shareholderDraw === null) {
      for (const pattern of PATTERNS.shareholderDraw) {
        if (pattern.test(line)) {
          result.shareholderDraw = findAmountForLabel(lines, i)
          break
        }
      }
    }
  }

  // Extract net income from the last occurrence
  if (lastNetIncomeIdx >= 0) {
    result.netIncome = findAmountForLabel(lines, lastNetIncomeIdx)
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
