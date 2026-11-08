import { useEffect, useState } from 'react'
import posthog, { isPostHogConfigured, posthogLog } from '../posthog.ts'
import { generateBook, type Puzzle } from '../sudoku/generate.ts'
import {
  DIFFICULTIES,
  GIVENS,
  PER_SHEET,
  SIZES,
  describeSheets,
  difficultyLabel,
  type Difficulty,
  type PerSheet,
  type Size,
} from '../sudoku/model.ts'
import { DailySubscribe } from './DailySubscribe.tsx'
import { PuzzleGrid } from './PuzzleGrid.tsx'

type Options = {
  difficulty: Difficulty
  size: Size
  count: number
  perSheet: PerSheet
  answers: boolean
}

const DIFFICULTY_COPY: Record<Difficulty, string> = {
  easy: 'More numbers already printed. A calm start for younger kids.',
  medium: 'A middle amount of help. Good once the easy books feel simple.',
  hard: 'The fewest starting numbers that still leave one answer. For kids who want a challenge.',
}

const SIZE_COPY: Record<Size, string> = {
  4: 'Small grid. Uses the numbers 1–4.',
  6: 'A step up. Uses the numbers 1–6.',
  9: 'Classic Sudoku. Uses the numbers 1–9.',
}

const SHEET_COPY: Record<PerSheet, string> = {
  1: 'One large puzzle',
  2: 'Two stacked',
  4: 'Four on a page',
}

const DEFAULTS: Options = {
  difficulty: 'easy',
  size: 4,
  count: 4,
  perSheet: 1,
  answers: true,
}

function sameOptions(a: Options, b: Options) {
  return a.difficulty === b.difficulty && a.size === b.size && a.count === b.count && a.perSheet === b.perSheet && a.answers === b.answers
}

function bookAttributes(options: Options) {
  return {
    difficulty: options.difficulty,
    grid_size: options.size,
    puzzle_count: options.count,
    puzzles_per_sheet: options.perSheet,
    includes_answer_key: options.answers,
  }
}

function captureBookEvent(event: string, options: Options) {
  if (!isPostHogConfigured) return
  posthog.capture(event, bookAttributes(options))
}

export function SudokuMaker({ onBack }: { onBack: () => void }) {
  const [options, setOptions] = useState<Options>(DEFAULTS)
  const [book, setBook] = useState<Puzzle[] | null>(null)
  const [madeWith, setMadeWith] = useState<Options | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Sudoku · OlloBooks'
    return () => {
      document.title = 'OlloBooks'
    }
  }, [])

  const stale = Boolean(book && madeWith && !sameOptions(options, madeWith))
  const cells = options.size * options.size

  function patch(partial: Partial<Options>) {
    setOptions((current) => ({ ...current, ...partial }))
  }

  async function makePdf() {
    setBusy(true)
    setError(null)
    setProgress('Starting…')
    const snapshot = options
    try {
      const puzzles = await generateBook({
        size: snapshot.size,
        difficulty: snapshot.difficulty,
        count: snapshot.count,
        onProgress: (current, total) => setProgress(`Making puzzle ${current} of ${total}…`),
      })
      setBook(puzzles)
      setMadeWith(snapshot)
      setProgress(null)
      captureBookEvent('sudoku_book_generated', snapshot)
      posthogLog.info('sudoku book generated', {
        operation: 'sudoku_book_generation',
        status: 'completed',
        ...bookAttributes(snapshot),
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not make that book.')
      setProgress(null)
      captureBookEvent('sudoku_book_generation_failed', snapshot)
      posthogLog.error('sudoku book generation failed', {
        operation: 'sudoku_book_generation',
        status: 'failed',
        ...bookAttributes(snapshot),
      })
    } finally {
      setBusy(false)
    }
  }

  async function download() {
    if (!book || !madeWith) return
    const { buildSudokuPdf } = await import('../pdf/sudokuPdf.ts')
    const doc = buildSudokuPdf({
      puzzles: book,
      perSheet: madeWith.perSheet,
      includeAnswers: madeWith.answers,
    })
    doc.save(`ollobooks-sudoku-${madeWith.size}x${madeWith.size}-${madeWith.difficulty}.pdf`)
    captureBookEvent('sudoku_pdf_downloaded', madeWith)
    posthogLog.info('sudoku PDF download initiated', {
      operation: 'sudoku_pdf_download',
      status: 'initiated',
      ...bookAttributes(madeWith),
    })
  }

  const preview = book?.[0]

  return (
    <main className="page">
      <button className="back" type="button" onClick={onBack} disabled={busy}>
        ← Library
      </button>
      <header className="maker-head">
        <p className="eyebrow">Printable book</p>
        <h1>Sudoku</h1>
        <p className="lede tight">Pick the puzzle, then the paper. Nothing is generated until you make the PDF.</p>
      </header>

      <div className="maker-layout">
        <form
          className="maker-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!busy) void makePdf()
          }}
        >
          <fieldset disabled={busy}>
            <legend>Puzzle</legend>
            <p className="field-label">Difficulty</p>
            <div className="choices" role="group" aria-label="Difficulty">
              {DIFFICULTIES.map((level) => (
                <button
                  key={level}
                  type="button"
                  className="choice"
                  aria-pressed={options.difficulty === level}
                  onClick={() => patch({ difficulty: level })}
                >
                  <strong>{difficultyLabel(level)}</strong>
                  <span>
                    {GIVENS[options.size][level]} of {cells} filled in
                  </span>
                </button>
              ))}
            </div>
            <p className="hint">{DIFFICULTY_COPY[options.difficulty]}</p>

            <p className="field-label">Grid</p>
            <div className="choices" role="group" aria-label="Grid size">
              {SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className="choice"
                  aria-pressed={options.size === size}
                  onClick={() => patch({ size })}
                >
                  <strong>
                    {size}×{size}
                  </strong>
                  <span>Numbers 1–{size}</span>
                </button>
              ))}
            </div>
            <p className="hint">{SIZE_COPY[options.size]}</p>

            <p className="field-label" id="count-label">
              How many puzzles
            </p>
            <div className="stepper">
              <button type="button" className="step" onClick={() => patch({ count: Math.max(1, options.count - 1) })} disabled={options.count <= 1}>
                −
              </button>
              <input
                aria-labelledby="count-label"
                type="number"
                min={1}
                max={20}
                value={options.count}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (!Number.isFinite(next)) return
                  patch({ count: Math.min(20, Math.max(1, Math.round(next))) })
                }}
              />
              <button type="button" className="step" onClick={() => patch({ count: Math.min(20, options.count + 1) })} disabled={options.count >= 20}>
                +
              </button>
            </div>
            <p className="hint">Up to 20 puzzles in one download.</p>
          </fieldset>

          <fieldset disabled={busy}>
            <legend>Print settings</legend>
            <p className="field-label">Puzzles per sheet</p>
            <div className="choices" role="group" aria-label="Puzzles per sheet">
              {PER_SHEET.map((count) => (
                <button
                  key={count}
                  type="button"
                  className="choice"
                  aria-pressed={options.perSheet === count}
                  onClick={() => patch({ perSheet: count })}
                >
                  <strong>{count}</strong>
                  <span>{SHEET_COPY[count]}</span>
                </button>
              ))}
            </div>
            <p className="paper-note">US Letter. Fits a home printer.</p>
            <label className="check">
              <input
                type="checkbox"
                checked={options.answers}
                onChange={(event) => patch({ answers: event.target.checked })}
              />
              <span>
                Include answer key
                <small>Printed after the puzzles, with the answers filled in.</small>
              </span>
            </label>
          </fieldset>

          <p className="slip">{describeSheets(options.count, options.perSheet, options.answers)}</p>
          <p className="live" aria-live="polite">
            {progress}
          </p>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="actions">
            <button className="primary" type="submit" disabled={busy}>
              {busy ? progress ?? 'Making…' : 'Make PDF'}
            </button>
            <button className="ghost" type="button" onClick={() => void download()} disabled={!book || stale || busy}>
              Download PDF
            </button>
          </div>
        </form>

        <aside className="preview-panel">
          <p className="eyebrow">Preview</p>
          <h2>First puzzle</h2>
          {preview ? (
            <>
              <p className="hint">
                Puzzle 1 of {book?.length} · {difficultyLabel(preview.difficulty)} · {preview.size}×{preview.size}
              </p>
              {stale ? <p className="stale">These settings differ from the preview. Make the PDF again before you download.</p> : null}
              <PuzzleGrid grid={preview.puzzle} size={preview.size} />
            </>
          ) : (
            <div className="preview-empty">
              <p>Your first puzzle will show up here after you make the PDF.</p>
            </div>
          )}
        </aside>
      </div>
      <DailySubscribe placement="maker" />
    </main>
  )
}
