import { describe, expect, it } from 'vitest'
import { generateBook, generatePuzzle, findSolutions, boxDigits } from './generate.ts'
import { clueCount, describeSheets, isCompleteAndValid, sheetPlan } from './model.ts'

function agrees(puzzle: number[][], solution: number[][]) {
  for (let row = 0; row < puzzle.length; row += 1) {
    for (let col = 0; col < puzzle[row].length; col += 1) {
      if (puzzle[row][col] !== 0 && puzzle[row][col] !== solution[row][col]) return false
    }
  }
  return true
}

describe('sudoku generator', () => {
  it('fills a valid 4×4 and keeps one solution after digging', () => {
    const made = generatePuzzle(4, 'medium', 42)
    expect(made).not.toBeNull()
    expect(isCompleteAndValid(made!.solution, 4)).toBe(true)
    expect(agrees(made!.puzzle, made!.solution)).toBe(true)
    const search = findSolutions(made!.puzzle.map((row) => row.slice()), 4, 2, Date.now() + 2000)
    expect(search.count).toBe(1)
  })

  it('gives hard 4×4 puzzles fewer clues than easy ones', () => {
    for (const seed of [1, 8, 21, 42]) {
      const easy = generatePuzzle(4, 'easy', seed)
      const hard = generatePuzzle(4, 'hard', seed)
      expect(easy).not.toBeNull()
      expect(hard).not.toBeNull()
      expect(clueCount(hard!.puzzle)).toBeLessThan(clueCount(easy!.puzzle))
      expect(clueCount(hard!.puzzle)).toBeGreaterThanOrEqual(6)
      expect(clueCount(easy!.puzzle)).toBeGreaterThanOrEqual(10)
      expect(hard!.puzzle.flat().some((value) => value !== 0)).toBe(true)
    }
  })

  it('uses 2×3 boxes for a complete 6×6', () => {
    const made = generatePuzzle(6, 'easy', 5)
    expect(made).not.toBeNull()
    expect(isCompleteAndValid(made!.solution, 6)).toBe(true)
    for (const box of boxDigits(made!.solution, 6)) {
      expect(box).toHaveLength(6)
      expect(new Set(box)).toEqual(new Set([1, 2, 3, 4, 5, 6]))
    }
    const search = findSolutions(made!.puzzle.map((row) => row.slice()), 6, 2, Date.now() + 3000)
    expect(search.count).toBe(1)
    expect(clueCount(made!.puzzle)).toBeGreaterThan(clueCount(generatePuzzle(6, 'hard', 5)!.puzzle))
  })

  it('builds a unique 9×9 puzzle', () => {
    const easy = generatePuzzle(9, 'easy', 11)
    const hard = generatePuzzle(9, 'hard', 11)
    expect(easy).not.toBeNull()
    expect(hard).not.toBeNull()
    expect(isCompleteAndValid(easy!.solution, 9)).toBe(true)
    expect(clueCount(hard!.puzzle)).toBeLessThan(clueCount(easy!.puzzle))
    expect(clueCount(hard!.puzzle)).toBeGreaterThanOrEqual(28)
    const search = findSolutions(easy!.puzzle.map((row) => row.slice()), 9, 2, Date.now() + 4000)
    expect(search.count).toBe(1)
  })

  it('builds different puzzles in one book', async () => {
    const book = await generateBook({ size: 4, difficulty: 'easy', count: 4, seed: 7 })
    expect(book).toHaveLength(4)
    const fingerprints = new Set(book.map((puzzle) => puzzle.puzzle.flat().join(',')))
    expect(fingerprints.size).toBe(4)
  })

  it('describes how puzzles land on sheets', () => {
    expect(describeSheets(8, 4, false)).toContain('2 puzzle sheets')
    expect(sheetPlan(8, 4, true)).toEqual({ puzzleSheets: 2, answerSheets: 2, total: 4 })
    expect(sheetPlan(1, 2, false).puzzleSheets).toBe(1)
  })
})
