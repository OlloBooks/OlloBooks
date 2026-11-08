import { jsPDF } from 'jspdf'
import { difficultyLabel, type PerSheet } from '../sudoku/model.ts'
import type { Puzzle } from '../sudoku/generate.ts'

export type PdfBook = {
  puzzles: Puzzle[]
  perSheet: PerSheet
  includeAnswers: boolean
}

type Slot = { x: number; y: number; w: number; h: number }

const MARGIN = 12

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size))
  }
  return pages
}

function layoutSlots(doc: jsPDF, perSheet: PerSheet): Slot[] {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const top = 18
  const gap = 6
  const width = pageW - MARGIN * 2
  const height = pageH - top - MARGIN
  if (perSheet === 1) return [{ x: MARGIN, y: top, w: width, h: height }]
  if (perSheet === 2) {
    const slotH = (height - gap) / 2
    return [
      { x: MARGIN, y: top, w: width, h: slotH },
      { x: MARGIN, y: top + slotH + gap, w: width, h: slotH },
    ]
  }
  const slotW = (width - gap) / 2
  const slotH = (height - gap) / 2
  return [
    { x: MARGIN, y: top, w: slotW, h: slotH },
    { x: MARGIN + slotW + gap, y: top, w: slotW, h: slotH },
    { x: MARGIN, y: top + slotH + gap, w: slotW, h: slotH },
    { x: MARGIN + slotW + gap, y: top + slotH + gap, w: slotW, h: slotH },
  ]
}

function drawGrid(doc: jsPDF, grid: number[][], originX: number, originY: number, gridSize: number, reveal: boolean) {
  const size = grid.length
  const cell = gridSize / size
  const boxRows = size === 6 ? 2 : size === 4 ? 2 : 3
  const boxCols = size === 6 ? 3 : size === 4 ? 2 : 3

  if (reveal) {
    doc.setFillColor(231, 242, 232)
    doc.rect(originX, originY, gridSize, gridSize, 'F')
  }

  doc.setDrawColor(120, 104, 88)
  doc.setLineWidth(0.18)
  for (let index = 0; index <= size; index += 1) {
    const offset = index * cell
    doc.line(originX, originY + offset, originX + gridSize, originY + offset)
    doc.line(originX + offset, originY, originX + offset, originY + gridSize)
  }

  doc.setDrawColor(28, 22, 18)
  doc.setLineWidth(0.75)
  for (let index = 0; index <= size / boxRows; index += 1) {
    const y = originY + index * boxRows * cell
    doc.line(originX, y, originX + gridSize, y)
  }
  for (let index = 0; index <= size / boxCols; index += 1) {
    const x = originX + index * boxCols * cell
    doc.line(x, originY, x, originY + gridSize)
  }

  doc.setFont('times', 'bold')
  doc.setFontSize(Math.max(8, cell * 2.15))
  doc.setTextColor(reveal ? 30 : 28, reveal ? 92 : 22, reveal ? 62 : 18)
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const value = grid[row][col]
      if (!value) continue
      doc.text(String(value), originX + col * cell + cell / 2, originY + row * cell + cell / 2, {
        align: 'center',
        baseline: 'middle',
      })
    }
  }
}

function drawSlot(doc: jsPDF, slot: Slot, grid: number[][], label: string, reveal: boolean) {
  doc.setFont('times', 'bold')
  doc.setFontSize(slot.h > 100 ? 12 : 9)
  doc.setTextColor(36, 28, 22)
  doc.text(label, slot.x, slot.y + 4)

  const labelBlock = 7
  const gridSize = Math.min(slot.w, slot.h - labelBlock)
  const x = slot.x + (slot.w - gridSize) / 2
  const y = slot.y + labelBlock + (slot.h - labelBlock - gridSize) / 2
  drawGrid(doc, grid, x, y, gridSize, reveal)
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
    doc.text('Answer key', 44, 12)
  } else {
    doc.setTextColor(110, 78, 52)
    doc.text('Sudoku', 44, 12)
  }
  doc.setFont('times', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(130, 112, 94)
  doc.text('US Letter', pageW - MARGIN, 12, { align: 'right' })
  doc.setFontSize(8)
  doc.text(answer ? 'Answers' : 'Puzzles', MARGIN, pageH - 6)
  doc.text(`${pageNumber} / ${total}`, pageW - MARGIN, pageH - 6, { align: 'right' })
}

export function buildSudokuPdf(book: PdfBook): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  doc.setProperties({ title: 'OlloBooks Sudoku', author: 'OlloBooks' })
  const pages = chunk(book.puzzles, book.perSheet)
  const total = pages.length + (book.includeAnswers ? pages.length : 0)
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
    const slots = layoutSlots(doc, book.perSheet)
    group.forEach((puzzle, index) => {
      const number = pageIndex * book.perSheet + index + 1
      const label = `Puzzle ${number}   ·   ${puzzle.size}×${puzzle.size}   ·   ${difficultyLabel(puzzle.difficulty)}`
      drawSlot(doc, slots[index], puzzle.puzzle, label, false)
    })
  })

  if (book.includeAnswers) {
    pages.forEach((group, pageIndex) => {
      open(true)
      const slots = layoutSlots(doc, book.perSheet)
      group.forEach((puzzle, index) => {
        const number = pageIndex * book.perSheet + index + 1
        const label = `Answer ${number}   ·   ${puzzle.size}×${puzzle.size}   ·   ${difficultyLabel(puzzle.difficulty)}`
        drawSlot(doc, slots[index], puzzle.solution, label, true)
      })
    })
  }

  return doc
}

export function pdfBytes(doc: jsPDF): Uint8Array {
  return new Uint8Array(doc.output('arraybuffer'))
}
