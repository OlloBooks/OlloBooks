import type { Difficulty } from '../sudoku/model.ts'
import { canScramble } from './model.ts'
import { WORD_LISTS } from './words.ts'

export type AnagramItem = {
  answer: string
  scramble: string
}

type Rng = () => number

function mulberry32(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = items.slice()
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1))
    const current = copy[index]
    copy[index] = copy[swap]
    copy[swap] = current
  }
  return copy
}

export function spellOut(scramble: string): string {
  return scramble.toUpperCase().split('').join(' ')
}

export function scrambleWord(word: string, rng: Rng): string {
  const original = word.toLowerCase()
  const letters = original.split('')
  if (!canScramble(original)) {
    throw new Error(`"${word}" needs two different letters so it can be scrambled.`)
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const next = shuffle(letters, rng).join('')
    if (next !== original) return next
  }
  const chars = letters.slice()
  for (let i = 0; i < chars.length; i += 1) {
    for (let j = i + 1; j < chars.length; j += 1) {
      if (chars[i] === chars[j]) continue
      const next = chars.slice()
      const held = next[i]
      next[i] = next[j]
      next[j] = held
      return next.join('')
    }
  }
  throw new Error(`"${word}" needs two different letters so it can be scrambled.`)
}

function titleWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function scrambleWords(words: readonly string[], seed: number): AnagramItem[] {
  const rng = mulberry32(seed)
  return words.map((word) => {
    const answer = word.trim()
    return { answer, scramble: scrambleWord(answer, rng) }
  })
}

export function buildDifficultySheet(difficulty: Difficulty, count: number, seed: number): AnagramItem[] {
  const list = WORD_LISTS[difficulty]
  if (count < 1 || count > list.length) throw new Error('Not enough words for that sheet.')
  const rng = mulberry32(seed)
  const picked = shuffle(list, rng).slice(0, count)
  return picked.map((word) => ({
    answer: titleWord(word),
    scramble: scrambleWord(word, rng),
  }))
}
