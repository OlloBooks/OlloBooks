import { DIFFICULTIES, SIZES, type Difficulty, type Size } from '../sudoku/model.ts'

export const MIN_DAILY_PUZZLES = 1
export const MAX_DAILY_PUZZLES = 6
export const DEFAULT_DAILY_PUZZLES = 3

export type SubscriptionRequest = {
  email: string
  size: Size
  difficulty: Difficulty
  count: number
  includeAnswers: boolean
}

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidEmail(value: string): boolean {
  const email = normalizeEmail(value)
  return email.length <= 254 && EMAIL.test(email)
}

export type ValidationResult =
  | { ok: true; value: SubscriptionRequest }
  | { ok: false; error: string }

export function validateSubscription(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  const body = input as Record<string, unknown>
  const email = normalizeEmail(typeof body.email === 'string' ? body.email : '')
  if (!isValidEmail(email)) return { ok: false, error: 'Enter a valid email address.' }

  const size = parseSize(body.size)
  if (!size) return { ok: false, error: 'Choose a 4×4, 6×6, or 9×9 grid.' }

  const difficulty = parseDifficulty(body.difficulty)
  if (!difficulty) return { ok: false, error: 'Choose Easy, Medium, or Hard.' }

  const count = parseCount(body.count)
  if (count == null) return { ok: false, error: 'Choose between 1 and 6 puzzles.' }

  const includeAnswers = parseAnswers(body.includeAnswers)
  if (includeAnswers == null) return { ok: false, error: 'Choose whether to include an answer key.' }

  return { ok: true, value: { email, size, difficulty, count, includeAnswers } }
}

function parseSize(value: unknown): Size | null {
  if (value == null || value === '') return 4
  const number = typeof value === 'string' ? Number(value) : value
  if (typeof number !== 'number') return null
  return SIZES.find((size) => size === number) ?? null
}

function parseDifficulty(value: unknown): Difficulty | null {
  if (value == null || value === '') return 'easy'
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return DIFFICULTIES.find((level) => level === normalized) ?? null
}

function parseCount(value: unknown): number | null {
  if (value == null || value === '') return DEFAULT_DAILY_PUZZLES
  const number = typeof value === 'string' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isInteger(number)) return null
  if (number < MIN_DAILY_PUZZLES || number > MAX_DAILY_PUZZLES) return null
  return number
}

function parseAnswers(value: unknown): boolean | null {
  if (value == null) return true
  if (typeof value === 'boolean') return value
  return null
}
