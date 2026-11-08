import { fw } from '@fireweaveai/web-sdk/start'
import { useState } from 'react'
import { DIFFICULTIES, SIZES, difficultyLabel, type Difficulty, type Size } from '../sudoku/model.ts'
import { MAX_DAILY_PUZZLES, MIN_DAILY_PUZZLES, validateSubscription } from '../subscription/validate.ts'

type Placement = 'library' | 'maker'
type Status = 'idle' | 'saving' | 'done' | 'error'

const COPY: Record<Placement, { title: string; lede: string }> = {
  library: {
    title: 'A few puzzles in your inbox',
    lede: 'A few Sudoku puzzles for kids to print, delivered each morning as a letter-size PDF.',
  },
  maker: {
    title: 'Send a few of these each morning',
    lede: 'Same warm paper puzzles, chosen once. A few pages for kids to print, on US Letter.',
  },
}

export function DailySubscribe({ placement }: { placement: Placement }) {
  // @fireweave-controlpoint daily-kids-puzzles
  const enabled = fw.controlPoints.getBooleanValue('daily-kids-puzzles', false)
  const [email, setEmail] = useState('')
  const [size, setSize] = useState<Size>(4)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [count, setCount] = useState(3)
  const [includeAnswers, setIncludeAnswers] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)

  if (!enabled) return null

  const copy = COPY[placement]
  const saving = status === 'saving'

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault()
    const parsed = validateSubscription({ email, size, difficulty, count, includeAnswers })
    if (!parsed.ok) {
      setStatus('error')
      setMessage(parsed.error)
      return
    }

    setStatus('saving')
    setMessage(null)
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.value),
      })
      const data = (await response.json()) as { ok?: boolean; message?: string; error?: string }
      if (!response.ok || !data.ok) {
        setStatus('error')
        setMessage(data.error ?? "We couldn't save that subscription. Please try again.")
        return
      }
      setStatus('done')
      setMessage(data.message ?? "You're on the list. The first PDF arrives the next morning.")
    } catch {
      setStatus('error')
      setMessage("We couldn't save that subscription. Please try again.")
    }
  }

  return (
    <section className="subscribe" id="daily-puzzles" aria-labelledby="daily-puzzles-title">
      <div className="subscribe-card">
        <p className="eyebrow">Every morning</p>
        <h2 id="daily-puzzles-title">{copy.title}</h2>
        <p className="subscribe-lede">{copy.lede}</p>

        {status === 'done' ? (
          <div className="subscribe-success" role="status">
            <p>{message}</p>
            <p className="hint">You can unsubscribe from any email.</p>
          </div>
        ) : (
          <form className="subscribe-form" noValidate onSubmit={(event) => void submit(event)}>
            <label className="field-label" htmlFor="daily-email">
              Email address
            </label>
            <input
              id="daily-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              disabled={saving}
              aria-invalid={status === 'error'}
              onChange={(event) => {
                setEmail(event.target.value)
                if (status === 'error') setStatus('idle')
              }}
            />

            <p className="field-label">Grid size</p>
            <div className="choices" role="group" aria-label="Grid size">
              {SIZES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="choice"
                  aria-pressed={size === option}
                  disabled={saving}
                  onClick={() => setSize(option)}
                >
                  <strong>
                    {option}×{option}
                  </strong>
                </button>
              ))}
            </div>

            <p className="field-label">Difficulty</p>
            <div className="choices" role="group" aria-label="Difficulty">
              {DIFFICULTIES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="choice"
                  aria-pressed={difficulty === option}
                  disabled={saving}
                  onClick={() => setDifficulty(option)}
                >
                  <strong>{difficultyLabel(option)}</strong>
                </button>
              ))}
            </div>

            <p className="field-label" id="daily-count-label">
              How many puzzles each morning
            </p>
            <div className="stepper">
              <button
                type="button"
                className="step"
                onClick={() => setCount((current) => Math.max(MIN_DAILY_PUZZLES, current - 1))}
                disabled={saving || count <= MIN_DAILY_PUZZLES}
              >
                −
              </button>
              <input
                aria-labelledby="daily-count-label"
                type="number"
                min={MIN_DAILY_PUZZLES}
                max={MAX_DAILY_PUZZLES}
                value={count}
                disabled={saving}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (!Number.isInteger(next)) return
                  setCount(Math.min(MAX_DAILY_PUZZLES, Math.max(MIN_DAILY_PUZZLES, next)))
                }}
              />
              <button
                type="button"
                className="step"
                onClick={() => setCount((current) => Math.min(MAX_DAILY_PUZZLES, current + 1))}
                disabled={saving || count >= MAX_DAILY_PUZZLES}
              >
                +
              </button>
            </div>
            <p className="hint">A few puzzles for kids to print.</p>

            <label className="check">
              <input
                type="checkbox"
                checked={includeAnswers}
                disabled={saving}
                onChange={(event) => setIncludeAnswers(event.target.checked)}
              />
              <span>
                Include answer key
                <small>Printed after the puzzles, with the answers filled in.</small>
              </span>
            </label>

            {status === 'error' && message ? (
              <p className="error" role="alert">
                {message}
              </p>
            ) : null}

            <div className="actions">
              <button className="primary" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Send puzzles each morning'}
              </button>
            </div>
            <p className="hint">You can unsubscribe from any email.</p>
          </form>
        )}
      </div>
    </section>
  )
}
