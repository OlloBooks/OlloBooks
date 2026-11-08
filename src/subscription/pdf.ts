import { buildSudokuPdf, pdfBytes } from '../pdf/sudokuPdf.ts'
import { generateBook } from '../sudoku/generate.ts'
import type { Subscriber } from './store.ts'

export async function buildDailyPdf(
  subscriber: Pick<Subscriber, 'size' | 'difficulty' | 'count' | 'includeAnswers'>,
  seed?: number,
): Promise<{ bytes: Uint8Array; pages: number }> {
  const puzzles = await generateBook({
    size: subscriber.size,
    difficulty: subscriber.difficulty,
    count: subscriber.count,
    seed,
  })
  const doc = buildSudokuPdf({
    puzzles,
    perSheet: 1,
    includeAnswers: subscriber.includeAnswers,
  })
  return { bytes: pdfBytes(doc), pages: doc.getNumberOfPages() }
}

export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
}
