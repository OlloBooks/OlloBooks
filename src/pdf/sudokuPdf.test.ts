import { describe, expect, it } from 'vitest'
import { generateBook } from '../sudoku/generate.ts'
import { buildSudokuPdf, pdfBytes } from './sudokuPdf.ts'

describe('sudoku pdf', () => {
  it('writes a US Letter PDF whose page count follows puzzles per sheet', async () => {
    const puzzles = await generateBook({ size: 4, difficulty: 'easy', count: 8, seed: 9 })
    const doc = buildSudokuPdf({ puzzles, perSheet: 4, includeAnswers: true })
    const bytes = pdfBytes(doc)
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('%PDF')
    expect(doc.getNumberOfPages()).toBe(4)
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(215.9, 0)
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(279.4, 0)
  })

  it('omits the answer key when it is turned off', async () => {
    const puzzles = await generateBook({ size: 4, difficulty: 'medium', count: 3, seed: 4 })
    const doc = buildSudokuPdf({ puzzles, perSheet: 2, includeAnswers: false })
    expect(doc.getNumberOfPages()).toBe(2)
  })
})
