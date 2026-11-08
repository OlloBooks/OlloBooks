export type Size = 4 | 6 | 9
export type Difficulty = 'easy' | 'medium' | 'hard'
export type PerSheet = 1 | 2 | 4

export const SIZES: Size[] = [4, 6, 9]
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
export const PER_SHEET: PerSheet[] = [1, 2, 4]

export const BOX: Record<Size, { rows: number; cols: number }> = {
  4: { rows: 2, cols: 2 },
  6: { rows: 2, cols: 3 },
  9: { rows: 3, cols: 3 },
}

/** How many numbers stay printed for each size and difficulty. */
export const GIVENS: Record<Size, Record<Difficulty, number>> = {
  4: { easy: 10, medium: 8, hard: 6 },
  6: { easy: 24, medium: 18, hard: 14 },
  9: { easy: 45, medium: 35, hard: 28 },
}

export function difficultyLabel(difficulty: Difficulty): string {
  if (difficulty === 'easy') return 'Easy'
  if (difficulty === 'medium') return 'Medium'
  return 'Hard'
}

export function boxOf(size: Size, row: number, col: number): number {
  const { rows, cols } = BOX[size]
  const band = Math.floor(row / rows)
  const stack = Math.floor(col / cols)
  return band * (size / cols) + stack
}

export function clueCount(grid: number[][]): number {
  let count = 0
  for (const row of grid) {
    for (const value of row) {
      if (value !== 0) count += 1
    }
  }
  return count
}

export function isCompleteAndValid(grid: number[][], size: Size): boolean {
  if (grid.length !== size || grid.some((row) => row.length !== size)) return false

  const seen = (values: number[]) => {
    if (values.length !== size) return false
    const set = new Set(values)
    if (set.size !== size) return false
    for (let digit = 1; digit <= size; digit += 1) {
      if (!set.has(digit)) return false
    }
    return true
  }

  for (let index = 0; index < size; index += 1) {
    if (!seen(grid[index])) return false
    const column: number[] = []
    for (let row = 0; row < size; row += 1) column.push(grid[row][index])
    if (!seen(column)) return false
  }

  const { rows, cols } = BOX[size]
  for (let row = 0; row < size; row += rows) {
    for (let col = 0; col < size; col += cols) {
      const box: number[] = []
      for (let r = row; r < row + rows; r += 1) {
        for (let c = col; c < col + cols; c += 1) box.push(grid[r][c])
      }
      if (!seen(box)) return false
    }
  }

  return true
}

export function sheetPlan(count: number, perSheet: PerSheet, includeAnswers: boolean) {
  const puzzleSheets = Math.ceil(count / perSheet)
  const answerSheets = includeAnswers ? puzzleSheets : 0
  return { puzzleSheets, answerSheets, total: puzzleSheets + answerSheets }
}

export function describeSheets(count: number, perSheet: PerSheet, includeAnswers: boolean): string {
  const { puzzleSheets, answerSheets, total } = sheetPlan(count, perSheet, includeAnswers)
  const puzzles = count === 1 ? 'puzzle' : 'puzzles'
  const sheets = puzzleSheets === 1 ? 'puzzle sheet' : 'puzzle sheets'
  const answers = includeAnswers
    ? ` plus ${answerSheets} answer ${answerSheets === 1 ? 'sheet' : 'sheets'}`
    : ''
  const pages = total === 1 ? 'page' : 'pages'
  return `${count} ${puzzles} at ${perSheet} per sheet → ${puzzleSheets} ${sheets}${answers}. ${total} ${pages} in the PDF.`
}
