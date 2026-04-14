import * as pdfjsLib from 'pdfjs-dist'

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

/**
 * Extract text content from a PDF file.
 * Groups text items by Y position to reconstruct lines,
 * joins items on the same line with tabs, and separates pages.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
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
      // Round Y to nearest 3px to group items that are on the same visual line
      // but have slightly different baselines (common in PDF rendering)
      const rawY = (item as { transform: number[] }).transform[5]
      const y = Math.round(rawY / 3) * 3
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
export function parseDollarAmount(text: string): number | null {
  const cleaned = text.trim()

  const match = cleaned.match(/\$?\s*\(?\s*\$?\s*[-−]?\s*([\d,]+(?:\.\d{1,2})?)\s*\)?/)
  if (!match) return null

  const numStr = match[1].replace(/,/g, '')
  const value = parseFloat(numStr)
  if (isNaN(value)) return null

  // Negative if wrapped in parens or has minus/en-dash
  const isNegative = /\(.*\d.*\)/.test(cleaned) || /[-−]/.test(cleaned)
  return isNegative ? -value : value
}

/**
 * Extract the YTD (last/rightmost) dollar amount from a line.
 */
export function findYTDAmount(line: string, preserveSign = false): number | null {
  const amounts = line.match(/[-−]?\s*\$?\s*\(?\s*\$?\s*[\d,]+(?:\.\d{1,2})?\s*\)?/g)
  if (!amounts || amounts.length === 0) return null

  const validAmounts = amounts.filter(a => /\d/.test(a))
  if (validAmounts.length === 0) return null

  const val = parseDollarAmount(validAmounts[validAmounts.length - 1])
  if (val === null) return null

  return preserveSign ? val : Math.abs(val)
}
