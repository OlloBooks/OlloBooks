// Sudoku generator for OlloBooks printable books.
// Fills a valid grid, then removes clues while keeping a single solution.

import {
  BOX,
  GIVENS,
  boxOf,
  type Difficulty,
  type Size,
} from './model.ts'

export type Puzzle = {
  size: Size
  difficulty: Difficulty
  puzzle: number[][]
  solution: number[][]
}

type Rng = () => number

const DIG_BUDGET_MS: Record<Size, number> = {
  4: 200,
  6: 800,
  9: 1600,
}

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const copy = items.slice()
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1))
    const current = copy[index]
    copy[index] = copy[swap]
    copy[swap] = current
  }
  return copy
}

function popcount(value: number): number {
  let count = 0
  let bits = value
  while (bits) {
    bits &= bits - 1
    count += 1
  }
  return count
}

function bitToDigit(bit: number): number {
  let digit = 1
  let rest = bit
  while (rest > 1) {
    rest >>= 1
    digit += 1
  }
  return digit
}

function digitsFromMask(mask: number, rng: Rng): number[] {
  const digits: number[] = []
  let rest = mask
  while (rest) {
    const bit = rest & -rest
    rest &= rest - 1
    digits.push(bitToDigit(bit))
  }
  return shuffle(digits, rng)
}

export function fillGrid(size: Size, rng: Rng, deadline: number): number[][] | null {
  const grid = Array.from({ length: size }, () => Array<number>(size).fill(0))
  const all = (1 << size) - 1
  const rows = Array.from({ length: size }, () => all)
  const cols = Array.from({ length: size }, () => all)
  const boxes = Array.from({ length: size }, () => all)
  const empties: Array<[number, number]> = []
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) empties.push([row, col])
  }

  const visit = (): boolean => {
    if (empties.length === 0) return true
    if (Date.now() > deadline) return false

    let bestIndex = 0
    let bestCount = Number.POSITIVE_INFINITY
    let bestMask = 0
    for (let index = 0; index < empties.length; index += 1) {
      const [row, col] = empties[index]
      const mask = rows[row] & cols[col] & boxes[boxOf(size, row, col)]
      const candidates = popcount(mask)
      if (candidates < bestCount) {
        bestCount = candidates
        bestIndex = index
        bestMask = mask
        if (candidates === 0) break
      }
    }
    if (bestCount === 0) return false

    const last = empties.length - 1
    const picked = empties[bestIndex]
    empties[bestIndex] = empties[last]
    empties[last] = picked
    const cell = empties.pop()
    if (!cell) return false
    const [row, col] = cell
    const box = boxOf(size, row, col)

    for (const digit of digitsFromMask(bestMask, rng)) {
      const bit = 1 << (digit - 1)
      rows[row] &= ~bit
      cols[col] &= ~bit
      boxes[box] &= ~bit
      grid[row][col] = digit
      if (visit()) return true
      grid[row][col] = 0
      rows[row] |= bit
      cols[col] |= bit
      boxes[box] |= bit
    }

    empties.push([row, col])
    return false
  }

  return visit() ? grid : null
}

export type SolutionSearch = { count: number; solution: number[][] | null }

/** Counts solutions up to `limit`. Restores `grid`. A time cutoff reports `limit` so digging stops safely. */
export function findSolutions(
  grid: number[][],
  size: Size,
  limit: number,
  deadline: number,
): SolutionSearch {
  const all = (1 << size) - 1
  const rows = Array.from({ length: size }, () => all)
  const cols = Array.from({ length: size }, () => all)
  const boxes = Array.from({ length: size }, () => all)
  const empties: Array<[number, number]> = []

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const digit = grid[row][col]
      if (digit === 0) {
        empties.push([row, col])
        continue
      }
      const bit = 1 << (digit - 1)
      const box = boxOf(size, row, col)
      if ((rows[row] & bit) === 0 || (cols[col] & bit) === 0 || (boxes[box] & bit) === 0) {
        return { count: 0, solution: null }
      }
      rows[row] &= ~bit
      cols[col] &= ~bit
      boxes[box] &= ~bit
    }
  }

  let count = 0
  let solution: number[][] | null = null
  let timedOut = false

  const visit = () => {
    if (count >= limit || timedOut) return
    if (Date.now() > deadline) {
      timedOut = true
      return
    }
    if (empties.length === 0) {
      count += 1
      if (!solution) solution = grid.map((row) => row.slice())
      return
    }

    let bestIndex = 0
    let bestCount = Number.POSITIVE_INFINITY
    let bestMask = 0
    for (let index = 0; index < empties.length; index += 1) {
      const [row, col] = empties[index]
      const mask = rows[row] & cols[col] & boxes[boxOf(size, row, col)]
      const candidates = popcount(mask)
      if (candidates < bestCount) {
        bestCount = candidates
        bestIndex = index
        bestMask = mask
        if (candidates === 0) break
      }
    }
    if (bestCount === 0) return

    const last = empties.length - 1
    const picked = empties[bestIndex]
    empties[bestIndex] = empties[last]
    empties[last] = picked
    const cell = empties.pop()
    if (!cell) return
    const [row, col] = cell
    const box = boxOf(size, row, col)

    let mask = bestMask
    while (mask !== 0 && count < limit && !timedOut) {
      const bit = mask & -mask
      mask &= mask - 1
      rows[row] &= ~bit
      cols[col] &= ~bit
      boxes[box] &= ~bit
      grid[row][col] = bitToDigit(bit)
      visit()
      grid[row][col] = 0
      rows[row] |= bit
      cols[col] |= bit
      boxes[box] |= bit
    }

    empties.push([row, col])
  }

  visit()
  if (timedOut) return { count: limit, solution: null }
  return { count, solution }
}

function cellOrder(size: Size, rng: Rng): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) cells.push([row, col])
  }
  return shuffle(cells, rng)
}

function dig(solution: number[][], size: Size, target: number, rng: Rng, deadline: number): number[][] {
  const grid = solution.map((row) => row.slice())
  let clues = size * size
  for (const [row, col] of cellOrder(size, rng)) {
    if (clues <= target || Date.now() > deadline) break
    grid[row][col] = 0
    const search = findSolutions(grid, size, 2, deadline)
    if (search.count === 1) {
      clues -= 1
    } else {
      grid[row][col] = solution[row][col]
    }
  }
  return grid
}

export function generatePuzzle(size: Size, difficulty: Difficulty, seed: number): Puzzle | null {
  const rng = mulberry32(seed)
  const solution = fillGrid(size, rng, Date.now() + 500)
  if (!solution) return null
  const puzzle = dig(solution, size, GIVENS[size][difficulty], rng, Date.now() + DIG_BUDGET_MS[size])
  return { size, difficulty, puzzle, solution }
}

export async function generateBook(input: {
  size: Size
  difficulty: Difficulty
  count: number
  seed?: number
  onProgress?: (current: number, total: number) => void
}): Promise<Puzzle[]> {
  const puzzles: Puzzle[] = []
  const seen = new Set<string>()
  let seed = input.seed ?? Math.floor(Math.random() * 0x7fffffff)
  let attempts = 0
  const maxAttempts = Math.max(input.count * 12, input.count + 4)

  while (puzzles.length < input.count) {
    if (attempts >= maxAttempts) {
      throw new Error('Could not make enough different puzzles. Try fewer, or another size.')
    }
    attempts += 1
    input.onProgress?.(puzzles.length + 1, input.count)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const made = generatePuzzle(input.size, input.difficulty, seed)
    seed = (seed + 997) >>> 0
    if (!made) continue
    const fingerprint = made.puzzle.flat().join(',')
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    puzzles.push(made)
  }

  return puzzles
}

export function boxDigits(grid: number[][], size: Size): number[][] {
  const { rows, cols } = BOX[size]
  const boxes: number[][] = []
  for (let row = 0; row < size; row += rows) {
    for (let col = 0; col < size; col += cols) {
      const box: number[] = []
      for (let r = row; r < row + rows; r += 1) {
        for (let c = col; c < col + cols; c += 1) box.push(grid[r][c])
      }
      boxes.push(box)
    }
  }
  return boxes
}
