import { describe, expect, it } from 'vitest'
import { buildDifficultySheet, scrambleWords } from '../anagrams/scramble.ts'
import { buildAnagramPdf } from './anagramPdf.ts'
import { pdfBytes } from './sudokuPdf.ts'

describe('anagram pdf', () => {
  it('writes a US Letter worksheet plus an answer key', () => {
    const items = buildDifficultySheet('easy', 8, 3)
    const doc = buildAnagramPdf({ items, heading: 'Easy', includeAnswers: true })
    const bytes = pdfBytes(doc)
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('%PDF')
    expect(doc.getNumberOfPages()).toBe(2)
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(215.9, 0)
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(279.4, 0)
  })

  it('omits the answer key when it is turned off', () => {
    const items = scrambleWords(['crate', 'melon', 'brush', 'planet', 'garden'], 2)
    const doc = buildAnagramPdf({ items, heading: 'Your words', includeAnswers: false })
    expect(doc.getNumberOfPages()).toBe(1)
  })

  it('continues extra words on another sheet', () => {
    const items = buildDifficultySheet('hard', 12, 6)
    const doc = buildAnagramPdf({ items, heading: 'Hard', includeAnswers: true })
    expect(doc.getNumberOfPages()).toBe(4)
  })
})