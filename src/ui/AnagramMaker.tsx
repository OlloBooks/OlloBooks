import { useEffect, useState } from 'react'
import {
  DEFAULT_WORD_COUNT,
  MAX_CUSTOM_WORDS,
  MAX_DIFFICULTY_WORDS,
  MIN_DIFFICULTY_WORDS,
  MIN_WORDS,
  describeAnagramSheets,
  validateCustomWords,
} from '../anagrams/model.ts'
import { buildDifficultySheet, scrambleWords, spellOut, type AnagramItem } from '../anagrams/scramble.ts'
import posthog, { isPostHogConfigured, posthogLog } from '../posthog.ts'
import { ANAGRAM_TITLE, LIBRARY_TITLE } from '../seo.ts'
import { DIFFICULTIES, difficultyLabel, type Difficulty } from '../sudoku/model.ts'
import { DailySubscribe } from './DailySubscribe.tsx'

type Mode = 'difficulty' | 'custom'

type Options = {
  mode: Mode
  difficulty: Difficulty
  count: number
  answers: boolean
  words: string[]
}

type Sheet = {
  heading: string
  items: AnagramItem[]
  answers: boolean
}

const DIFFICULTY_COPY: Record<Difficulty, string> = {
  easy: 'Three- and four-letter words. A calm start for younger kids.',
  medium: 'Five- and six-letter words. Good once the short ones feel simple.',
  hard: 'Seven- and eight-letter words. For kids who want a challenge.',
}

const DEFAULTS: Options = {
  mode: 'difficulty',
  difficulty: 'easy',
  count: DEFAULT_WORD_COUNT,
  answers: true,
  words: Array.from({ length: MAX_CUSTOM_WORDS }, () => ''),
}

function filledCount(words: string[]) {
  return words.filter((word) => word.trim().length > 0).length
}

function sameOptions(a: Options, b: Options) {
  if (a.mode !== b.mode || a.answers !== b.answers) return false
  if (a.mode === 'difficulty') return a.difficulty === b.difficulty && a.count === b.count
  return a.words.every((word, index) => word.trim() === b.words[index].trim())
}

function slipText(options: Options) {
  if (options.mode === 'custom') {
    const count = filledCount(options.words)
    if (count < MIN_WORDS) return 'Enter 5 to 8 words. Each word needs at least 3 letters.'
    return describeAnagramSheets(count, options.answers)
  }
  return describeAnagramSheets(options.count, options.answers)
}

function sheetAttributes(options: Options) {
  return {
    mode: options.mode,
    difficulty: options.mode === 'difficulty' ? options.difficulty : 'custom',
    word_count: options.mode === 'difficulty' ? options.count : filledCount(options.words),
    includes_answer_key: options.answers,
  }
}

function captureSheetEvent(event: string, options: Options) {
  if (!isPostHogConfigured) return
  posthog.capture(event, sheetAttributes(options))
}

export function AnagramMaker({ onBack }: { onBack: () => void }) {
  const [options, setOptions] = useState<Options>(DEFAULTS)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [madeWith, setMadeWith] = useState<Options | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = ANAGRAM_TITLE
    return () => {
      document.title = LIBRARY_TITLE
    }
  }, [])

  const stale = Boolean(sheet && madeWith && !sameOptions(options, madeWith))

  function patch(partial: Partial<Options>) {
    setOptions((current) => ({ ...current, ...partial }))
    setError(null)
  }

  function setWord(index: number, value: string) {
    setOptions((current) => {
      const words = current.words.slice()
      words[index] = value
      return { ...current, words }
    })
    setError(null)
  }

  function makePdf() {
    setError(null)
    const snapshot = options
    const seed = Math.floor(Math.random() * 0x7fffffff)
    let customWords: string[] | null = null
    if (snapshot.mode === 'custom') {
      const parsed = validateCustomWords(snapshot.words)
      if (!parsed.ok) {
        setError(parsed.message)
        return
      }
      customWords = parsed.words
    }
    try {
      const items = customWords
        ? scrambleWords(customWords, seed)
        : buildDifficultySheet(snapshot.difficulty, snapshot.count, seed)
      setSheet({
        heading: snapshot.mode === 'custom' ? 'Your words' : difficultyLabel(snapshot.difficulty),
        items,
        answers: snapshot.answers,
      })
      setMadeWith(snapshot)
      captureSheetEvent('anagram_sheet_generated', snapshot)
      posthogLog.info('anagram sheet generated', {
        operation: 'anagram_sheet_generation',
        status: 'completed',
        ...sheetAttributes(snapshot),
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not scramble those words.')
      captureSheetEvent('anagram_sheet_generation_failed', snapshot)
      posthogLog.error('anagram sheet generation failed', {
        operation: 'anagram_sheet_generation',
        status: 'failed',
        ...sheetAttributes(snapshot),
      })
    }
  }

  async function download() {
    if (!sheet || !madeWith) return
    const { buildAnagramPdf } = await import('../pdf/anagramPdf.ts')
    const doc = buildAnagramPdf({
      items: sheet.items,
      heading: sheet.heading,
      includeAnswers: sheet.answers,
    })
    const slug = madeWith.mode === 'custom' ? 'custom' : madeWith.difficulty
    doc.save(`ollobooks-anagrams-${slug}.pdf`)
    captureSheetEvent('anagram_pdf_downloaded', madeWith)
    posthogLog.info('anagram PDF download initiated', {
      operation: 'anagram_pdf_download',
      status: 'initiated',
      ...sheetAttributes(madeWith),
    })
  }

  return (
    <main className="page anagram-page">
      <button className="back no-print" type="button" onClick={onBack}>
        ← Library
      </button>
      <header className="maker-head no-print">
        <p className="eyebrow">Printable worksheet</p>
        <h1>Anagrams</h1>
        <p className="lede tight">Pick the words, then the paper. Nothing is scrambled until you make the PDF.</p>
      </header>

      <div className="maker-layout">
        <form
          className="maker-form no-print"
          onSubmit={(event) => {
            event.preventDefault()
            makePdf()
          }}
        >
          <fieldset>
            <legend>Words</legend>
            <p className="field-label">How to choose</p>
            <div className="choices pair" role="group" aria-label="How to choose words">
              <button
                type="button"
                className="choice"
                aria-pressed={options.mode === 'difficulty'}
                onClick={() => patch({ mode: 'difficulty' })}
              >
                <strong>By difficulty</strong>
                <span>Words picked for you</span>
              </button>
              <button
                type="button"
                className="choice"
                aria-pressed={options.mode === 'custom'}
                onClick={() => patch({ mode: 'custom' })}
              >
                <strong>Your words</strong>
                <span>Type 5 to 8 words</span>
              </button>
            </div>

            {options.mode === 'difficulty' ? (
              <>
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
                      <span>{level === 'easy' ? '3–4 letters' : level === 'medium' ? '5–6 letters' : '7–8 letters'}</span>
                    </button>
                  ))}
                </div>
                <p className="hint">{DIFFICULTY_COPY[options.difficulty]}</p>

                <p className="field-label" id="anagram-count-label">
                  How many words
                </p>
                <div className="stepper">
                  <button
                    type="button"
                    className="step"
                    onClick={() => patch({ count: Math.max(MIN_DIFFICULTY_WORDS, options.count - 1) })}
                    disabled={options.count <= MIN_DIFFICULTY_WORDS}
                  >
                    −
                  </button>
                  <input
                    aria-labelledby="anagram-count-label"
                    type="number"
                    min={MIN_DIFFICULTY_WORDS}
                    max={MAX_DIFFICULTY_WORDS}
                    value={options.count}
                    onChange={(event) => {
                      const next = Number(event.target.value)
                      if (!Number.isFinite(next)) return
                      patch({ count: Math.min(MAX_DIFFICULTY_WORDS, Math.max(MIN_DIFFICULTY_WORDS, Math.round(next))) })
                    }}
                  />
                  <button
                    type="button"
                    className="step"
                    onClick={() => patch({ count: Math.min(MAX_DIFFICULTY_WORDS, options.count + 1) })}
                    disabled={options.count >= MAX_DIFFICULTY_WORDS}
                  >
                    +
                  </button>
                </div>
                <p className="hint">Eight words fit on one sheet. More than eight continue on the next page.</p>
              </>
            ) : (
              <>
                <p className="hint">Enter 5 to 8 words. Use letters only, at least 3 letters each, and don't repeat a word.</p>
                <div className="word-fields">
                  {options.words.map((word, index) => {
                    const inputId = `anagram-word-${index + 1}`
                    return (
                      <label key={inputId} htmlFor={inputId}>
                        Word {index + 1}
                        {index >= MIN_WORDS ? ' · optional' : ''}
                        <input
                          id={inputId}
                          type="text"
                          value={word}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          onChange={(event) => setWord(index, event.target.value)}
                        />
                      </label>
                    )
                  })}
                </div>
              </>
            )}
          </fieldset>

          <fieldset>
            <legend>Print settings</legend>
            <p className="paper-note">US Letter. Fits a home printer.</p>
            <label className="check">
              <input type="checkbox" checked={options.answers} onChange={(event) => patch({ answers: event.target.checked })} />
              <span>
                Include answer key
                <small>Printed after the worksheet, on its own page.</small>
              </span>
            </label>
          </fieldset>

          <p className="slip">{slipText(options)}</p>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="actions">
            <button className="primary" type="submit">
              Make PDF
            </button>
            <button className="ghost" type="button" onClick={() => void download()} disabled={!sheet || stale}>
              Download PDF
            </button>
            <button className="ghost" type="button" onClick={() => window.print()} disabled={!sheet || stale}>
              Print
            </button>
          </div>
        </form>

        <aside className="preview-panel">
          <div className="no-print">
            <p className="eyebrow">Preview</p>
            <h2>Worksheet</h2>
          </div>
          {sheet ? (
            <>
              {stale ? (
                <p className="stale no-print">These settings differ from the preview. Make the PDF again before you download.</p>
              ) : null}
              <article className="worksheet" aria-label="Anagram worksheet">
                <p className="worksheet-kicker">OlloBooks</p>
                <h2>Anagrams</h2>
                <p className="worksheet-meta">
                  {sheet.heading} · {sheet.items.length} {sheet.items.length === 1 ? 'word' : 'words'}
                </p>
                <p className="worksheet-instructions">Unscramble each word. Write the answer on the line.</p>
                <ol>
                  {sheet.items.map((item, index) => (
                    <li key={`${item.scramble}-${index}`}>
                      <span className="num">{index + 1}</span>
                      <p className="scramble">{spellOut(item.scramble)}</p>
                      <span className="write-line" />
                    </li>
                  ))}
                </ol>
              </article>
              {sheet.answers ? (
                <section className="answer-key" aria-label="Answer key">
                  <h2>Answer key</h2>
                  <p className="hint no-print">Prints on the next page.</p>
                  <ol>
                    {sheet.items.map((item, index) => (
                      <li key={`${item.answer}-${index}`}>
                        <span className="num">{index + 1}</span>
                        <span>{item.answer}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </>
          ) : (
            <div className="preview-empty">
              <p>Your scrambled words will show up here after you make the PDF.</p>
            </div>
          )}
        </aside>
      </div>
      <div className="no-print">
        <DailySubscribe placement="maker" />
      </div>
    </main>
  )
}
