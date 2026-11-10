import { jsPDF } from 'jspdf'
import type { AnagramItem } from '../anagrams/scramble.ts'
import { WORDS_PER_PAGE } from '../anagrams/model.ts'

export type AnagramPdfSheet = {
  items: AnagramItem[]
  heading: string
  includeAnswers: boolean
}

const MARGIN = 16

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size))
  }
  return pages
}

function drawChrome(doc: jsPDF, answer: boolean, pageNumber: number, total: number) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFont('times', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(36, 28, 22)
  doc.text('OlloBooks', MARGIN, 12)
  doc.setFont('times', 'italic')
  doc.setFontSize(12)
  if (answer) {
    doc.setTextColor(30, 92, 62)
    doc.text('Answer key', 48, 12)
  } else {
    doc.setTextColor(110, 78, 52)
    doc.text('Anagrams', 48, 12)
  }
  doc.setFont('times', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(130, 112, 94)
  doc.text('US Letter', pageW - MARGIN, 12, { align: 'right' })
  doc.setDrawColor(36, 28, 22)
  doc.setLineWidth(0.4)
  doc.line(MARGIN, 16, pageW - MARGIN, 16)
  doc.setFontSize(8)
  doc.text(answer ? 'Answers' : 'Worksheet', MARGIN, pageH - 8)
  doc.text(`${pageNumber} / ${total}`, pageW - MARGIN, pageH - 8, { align: 'right' })
}

function drawLetters(doc: jsPDF, scramble: string, x: number, y: number) {
  doc.setFont('times', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(36, 28, 22)
  let cursor = x
  for (const letter of scramble.toUpperCase()) {
    doc.text(letter, cursor, y)
    cursor += 6.2
  }
}

function drawItems(
  doc: jsPDF,
  items: AnagramItem[],
  startNumber: number,
  answer: boolean,
  heading: string,
  totalCount: number,
) {
  const pageW = doc.internal.pageSize.getWidth()
  doc.setFont('times', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(36, 28, 22)
  doc.text(answer ? 'Answer key' : 'Anagrams', MARGIN, 26)

  doc.setFont('times', 'italic')
  doc.setFontSize(12)
  doc.setTextColor(110, 78, 52)
  doc.text(`${heading} · ${totalCount} words`, MARGIN, 34)

  doc.setFont('times', 'normal')
  doc.setFontSize(11)
  doc.text(
    answer ? 'Answers for the worksheet.' : 'Unscramble each word. Write the answer on the line.',
    MARGIN,
    42,
  )

  let y = 56
  const step = answer ? 12 : 26
  items.forEach((item, index) => {
    const number = startNumber + index
    doc.setFont('times', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(36, 28, 22)
    doc.text(`${number}.`, MARGIN, y)
    const textX = MARGIN + 12
    if (answer) {
      doc.setTextColor(30, 92, 62)
      doc.text(item.answer, textX, y)
    } else {
      drawLetters(doc, item.scramble, textX, y)
      doc.setDrawColor(80, 64, 48)
      doc.setLineWidth(0.35)
      doc.line(textX, y + 8, pageW - MARGIN, y + 8)
    }
    y += step
  })
}

export function buildAnagramPdf(sheet: AnagramPdfSheet): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  doc.setProperties({ title: 'OlloBooks Anagrams', author: 'OlloBooks' })
  const pages = chunk(sheet.items, WORDS_PER_PAGE)
  const total = pages.length + (sheet.includeAnswers ? pages.length : 0)
  let pageNumber = 0
  let opened = false

  const open = (answer: boolean) => {
    if (opened) doc.addPage()
    opened = true
    pageNumber += 1
    drawChrome(doc, answer, pageNumber, total)
  }

  pages.forEach((group, pageIndex) => {
    open(false)
    drawItems(doc, group, pageIndex * WORDS_PER_PAGE + 1, false, sheet.heading, sheet.items.length)
  })

  if (sheet.includeAnswers) {
    pages.forEach((group, pageIndex) => {
      open(true)
      drawItems(doc, group, pageIndex * WORDS_PER_PAGE + 1, true, sheet.heading, sheet.items.length)
    })
  }

  return doc
}
