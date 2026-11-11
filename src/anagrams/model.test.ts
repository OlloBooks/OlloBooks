import { describe, expect, it } from 'vitest'
import { DIFFICULTIES, type Difficulty } from '../sudoku/model.ts'
import { canScramble, describeAnagramSheets, letterKey, validateCustomWords } from './model.ts'
import { WORD_LISTS } from './words.ts'

const BAND: Record<Difficulty, [number, number]> = {
  easy: [3, 4],
  medium: [5, 6],
  hard: [7, 8],
}

describe('anagram word lists', () => {
  it('keeps each difficulty in its length band, with words that can be scrambled', () => {
    const problems: string[] = []
    const seen = new Set<string>()
    const keys = new Set<string>()
    for (const difficulty of DIFFICULTIES) {
      const [min, max] = BAND[difficulty]
      expect(WORD_LISTS[difficulty].length).toBeGreaterThanOrEqual(12)
      for (const word of WORD_LISTS[difficulty]) {
        if (!/^[a-z]+$/.test(word)) problems.push(`${difficulty} ${word} is not lowercase letters`)
        if (word.length < min || word.length > max) problems.push(`${difficulty} ${word} is ${word.length} letters`)
        if (!canScramble(word)) problems.push(`${difficulty} ${word} cannot be scrambled`)
        if (seen.has(word)) problems.push(`${word} is listed twice`)
        seen.add(word)
        const key = letterKey(word)
        if (keys.has(key)) problems.push(`${word} uses the same letters as another listed word`)
        keys.add(key)
      }
    }
    expect(problems).toEqual([])
  })
})

describe('custom anagram words', () => {
  const five = ['crate', 'melon', 'brush', 'planet', 'garden']

  it('asks for at least 5 words', () => {
    expect(validateCustomWords(['cat', 'dog', 'sun', 'hat'])).toEqual({ ok: false, message: 'Enter at least 5 words.' })
    expect(validateCustomWords(['', '  ', 'cat'])).toEqual({ ok: false, message: 'Enter at least 5 words.' })
  })

  it('accepts 5 words and 8 words', () => {
    const eight = [...five, 'school', 'rocket', 'turtle']
    expect(validateCustomWords(five)).toEqual({ ok: true, words: five })
    expect(validateCustomWords([...eight, ''])).toEqual({ ok: true, words: eight })
  })

  function message(raw: string[]) {
    const result = validateCustomWords(raw)
    if (result.ok) throw new Error('expected those words to be rejected')
    return result.message
  }

  it('rejects a ninth word, short words, symbols, duplicates, and anagram pairs', () => {
    expect(validateCustomWords([...five, 'school', 'rocket', 'turtle', 'bridge']).ok).toBe(false)
    expect(message(['cat', 'dog', 'sun', 'hat', 'ok'])).toMatch(/too short/)
    expect(message(['cat', 'dog', 'sun', 'hat', 'cat!'])).toMatch(/letters only/)
    expect(message(['cat', 'dog', 'sun', 'hat', 'mmm'])).toMatch(/two different letters/)
    expect(message(['cat', 'dog', 'sun', 'hat', 'Cat'])).toMatch(/already on the list/)
    expect(message(['cat', 'dog', 'sun', 'hat', 'act'])).toMatch(/same letters/)
    expect(message(['crate', 'melon', 'brush', 'planet', 'supercalifragilistic'])).toMatch(/too long/)
  })
})

describe('anagram sheet plan', () => {
  it('puts the answer key on following pages', () => {
    expect(describeAnagramSheets(8, true)).toBe('8 words → 1 worksheet plus 1 answer sheet. 2 pages in the PDF.')
    expect(describeAnagramSheets(8, false)).toBe('8 words → 1 worksheet. 1 page in the PDF.')
    expect(describeAnagramSheets(12, true)).toBe('12 words → 2 worksheets plus 2 answer sheets. 4 pages in the PDF.')
  })
})
