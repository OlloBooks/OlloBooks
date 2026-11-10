import { describe, expect, it } from 'vitest'
import { letterKey } from './model.ts'
import { buildDifficultySheet, scrambleWords, spellOut } from './scramble.ts'
import { WORD_LISTS } from './words.ts'

function sorted(word: string) {
  return letterKey(word)
}

describe('scramble', () => {
  it('rearranges every word and never leaves it as written', () => {
    const words = ['book', 'seed', 'balloon', 'letter', 'scissors', 'bee', 'crate']
    for (let seed = 1; seed <= 30; seed += 1) {
      for (const item of scrambleWords(words, seed)) {
        expect(item.scramble).not.toBe(item.answer.toLowerCase())
        expect(sorted(item.scramble)).toBe(sorted(item.answer))
        expect(spellOut(item.scramble)).toBe(item.scramble.toUpperCase().split('').join(' '))
      }
    }
  })

  it('picks difficulty words from that list and keeps the same sheet for a seed', () => {
    const easy = buildDifficultySheet('easy', 8, 4)
    const hard = buildDifficultySheet('hard', 8, 4)
    expect(easy).toEqual(buildDifficultySheet('easy', 8, 4))
    expect(easy.map((item) => item.answer.toLowerCase()).every((word) => WORD_LISTS.easy.includes(word))).toBe(true)
    expect(hard.map((item) => item.answer.toLowerCase()).every((word) => WORD_LISTS.hard.includes(word))).toBe(true)
    expect(Math.max(...easy.map((item) => item.answer.length))).toBeLessThan(Math.min(...hard.map((item) => item.answer.length)))
    for (const item of [...easy, ...hard]) {
      expect(item.scramble).not.toBe(item.answer.toLowerCase())
      expect(sorted(item.scramble)).toBe(sorted(item.answer))
      expect(item.answer[0]).toBe(item.answer[0].toUpperCase())
    }
  })

  it('changes the sheet when the seed changes', () => {
    const first = buildDifficultySheet('medium', 8, 1).map((item) => item.answer).join()
    const second = buildDifficultySheet('medium', 8, 99).map((item) => item.answer).join()
    expect(first).not.toBe(second)
  })
})
