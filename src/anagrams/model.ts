export const MIN_WORDS = 5
export const MAX_CUSTOM_WORDS = 8
export const MIN_DIFFICULTY_WORDS = 5
export const MAX_DIFFICULTY_WORDS = 12
export const DEFAULT_WORD_COUNT = 8
export const MIN_WORD_LENGTH = 3
export const MAX_WORD_LENGTH = 12
export const WORDS_PER_PAGE = 8

export type WordListResult = { ok: true; words: string[] } | { ok: false; message: string }

export function letterKey(word: string): string {
  return word.toLowerCase().split('').sort().join('')
}

export function canScramble(word: string): boolean {
  const letters = word.toLowerCase()
  const first = letters[0]
  if (!first) return false
  for (let index = 1; index < letters.length; index += 1) {
    if (letters[index] !== first) return true
  }
  return false
}

export function validateCustomWords(raw: readonly string[]): WordListResult {
  const filled = raw.map((word) => word.trim()).filter((word) => word.length > 0)
  if (filled.length < MIN_WORDS) {
    return { ok: false, message: 'Enter at least 5 words.' }
  }
  if (filled.length > MAX_CUSTOM_WORDS) {
    return { ok: false, message: 'Use at most 8 words.' }
  }

  for (const word of filled) {
    if (word.length < MIN_WORD_LENGTH) {
      return { ok: false, message: `"${word}" is too short. Each word needs at least 3 letters.` }
    }
    if (word.length > MAX_WORD_LENGTH) {
      return { ok: false, message: `"${word}" is too long. Keep each word to 12 letters.` }
    }
    if (!/^[A-Za-z]+$/.test(word)) {
      return { ok: false, message: `"${word}" should use letters only.` }
    }
    if (!canScramble(word)) {
      return { ok: false, message: `"${word}" needs two different letters so it can be scrambled.` }
    }
  }

  const seen = new Set<string>()
  for (const word of filled) {
    const key = word.toLowerCase()
    if (seen.has(key)) {
      return { ok: false, message: `"${word}" is already on the list. Use each word once.` }
    }
    seen.add(key)
  }

  const byLetters = new Map<string, string>()
  for (const word of filled) {
    const key = letterKey(word)
    const prior = byLetters.get(key)
    if (prior) {
      return {
        ok: false,
        message: `"${prior}" and "${word}" use the same letters. Pick words that are not anagrams of each other.`,
      }
    }
    byLetters.set(key, word)
  }

  return { ok: true, words: filled }
}

export function describeAnagramSheets(count: number, includeAnswers: boolean): string {
  const sheets = Math.ceil(count / WORDS_PER_PAGE)
  const answerSheets = includeAnswers ? sheets : 0
  const total = sheets + answerSheets
  const wordLabel = count === 1 ? 'word' : 'words'
  const sheetLabel = sheets === 1 ? 'worksheet' : 'worksheets'
  const answers = includeAnswers ? ` plus ${answerSheets} answer ${answerSheets === 1 ? 'sheet' : 'sheets'}` : ''
  const pages = total === 1 ? 'page' : 'pages'
  return `${count} ${wordLabel} → ${sheets} ${sheetLabel}${answers}. ${total} ${pages} in the PDF.`
}
