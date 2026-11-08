import { fw } from '@fireweaveai/web-sdk/start'
import { useState } from 'react'
import { DIFFICULTIES, SIZES, difficultyLabel, type Difficulty, type Size } from '../sudoku/model.ts'
import {
  MAX_DAILY_PUZZLES,
  MIN_DAILY_PUZZLES,
  validateSubscription,
  type Schedule,
} from '../subscription/validate.ts'

type Placement = 'library' | 'maker'
type Status = 'idle' | 'saving' | 'done' | 'error'

const SCHEDULE_CHOICES: { id: Schedule; label: string; hint: string }[] = [
  { id: 'daily', label: 'Daily', hint: 'A few puzzles each morning' },
  { id: 'weekly', label: 'Weekly', hint: 'Once a week' },
  { id: 'monthly', label: 'Monthly', hint: 'Once a month' },
]

const WHEN: Record<Schedule, string> = {
  daily: 'each morning',
  weekly: 'once a week',
  monthly: 'once a month',
}

function titleFor(placement: Placement, schedule: Schedule): string {
  if (placement === 'library') return 'A few puzzles in your inbox'
  if (schedule === 'weekly') return 'Send a few of these each week'
  if (schedule === 'monthly') return 'Send a few of these each month'
  return 'Send a few of these each morning'
}

function ledeFor(placement: Placement, schedule: Schedule): string {
  const when = WHEN[schedule]
  if (placement === 'maker') {
    return `Same warm paper puzzles, chosen once. A few pages for kids to print, on US Letter, ${when}.`
  }
  return `A few Sudoku puzzles for kids to print, delivered ${when} as a letter-size PDF.`
}

export function DailySubscribe({ placement }: { placement: Placement }) {
  // @fireweave-controlpoint daily-kids-puzzles
  const enabled = fw.controlPoints.getBooleanValue('daily-kids-puzzles', false)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [schedule, setSchedule] = useState<Schedule>('daily')
  const [size, setSize] = useState<Size>(4)
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [count, setCount] = useState(3)
  const [includeAnswers, setIncludeAnswers] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)

  if (!enabled) return null

  const saving = status === 'saving'
  const panelId = `daily-puzzles-${placement}`
  const titleId = `daily-puzzles-title-${placement}`
  const emailId = `daily-email-${placement}`
  const countId = `daily-count-${placement}`
  const countLabel =
    schedule === 'weekly' ? 'How many puzzles each week' : schedule === 'monthly' ? 'How many puzzles each month' : 'How many puzzles each morning'
  const submitLabel =
    schedule === 'weekly' ? 'Send puzzles once a week' : schedule === 'monthly' ? 'Send puzzles once a month' : 'Send puzzles each morning'
  const eyebrow = schedule === 'weekly' ? 'Once a week' : schedule === 'monthly' ? 'Once a month' : 'Every morning'

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault()
    const parsed = validateSubscription({ email, size, difficulty, count, includeAnswers, schedule })
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
    <section className="subscribe">
      <button
        type="button"
        className="subscribe-prompt"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        Want this daily?
      </button>

      {open ? (
        <div className="subscribe-card" id={panelId} role="region" aria-labelledby={titleId}>
          <div className="subscribe-toolbar">
            <p className="eyebrow">{eyebrow}</p>
            <button type="button" className="subscribe-close" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <h2 id={titleId}>{titleFor(placement, schedule)}</h2>
          <p className="subscribe-lede">{ledeFor(placement, schedule)}</p>

          {status === 'done' ? (
            <div className="subscribe-success" role="status">
              <p>{message}</p>
              <p className="hint">You can unsubscribe from any email.</p>
            </div>
          ) : (
            <form className="subscribe-form" noValidate onSubmit={(event) => void submit(event)}>
              <label className="field-label" htmlFor={emailId}>
                Email address
              </label>
              <input
                id={emailId}
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

              <p className="field-label">How often</p>
              <div className="choices" role="group" aria-label="Schedule">
                {SCHEDULE_CHOICES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="choice"
                    aria-pressed={schedule === option.id}
                    disabled={saving}
                    onClick={() => setSchedule(option.id)}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.hint}</span>
                  </button>
                ))}
              </div>

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

              <p className="field-label" id={countId}>
                {countLabel}
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
                  aria-labelledby={countId}
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
                  {saving ? 'Saving…' : submitLabel}
                </button>
              </div>
              <p className="hint">You can unsubscribe from any email.</p>
            </form>
          )}
        </div>
      ) : null}
    </section>
  )
}
