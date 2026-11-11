import posthog, { isPostHogConfigured } from '../posthog.ts'
import { DailySubscribe } from './DailySubscribe.tsx'

const SAMPLE = ['', '2', '', '4', '3', '', '4', '', '', '1', '', '3', '2', '', '', '1']

export function Library({
  onOpen,
  anagramsEnabled,
}: {
  onOpen: (activity: 'sudoku' | 'anagrams') => void
  anagramsEnabled: boolean
}) {
  function openSudokuMaker() {
    if (isPostHogConfigured) posthog.capture('sudoku_maker_opened')
    onOpen('sudoku')
  }

  function openAnagrams() {
    if (isPostHogConfigured) posthog.capture('anagram_maker_opened')
    onOpen('anagrams')
  }

  return (
    <main className="page">
      <header className="mast">
        <div className="mark" aria-hidden="true">
          O
        </div>
        <div>
          <p className="eyebrow">Print shop for kids</p>
          <h1>OlloBooks</h1>
        </div>
      </header>
      <p className="lede">
        {anagramsEnabled
          ? 'Free printable books you make at the kitchen table. Sudoku and anagrams are ready. Bingo, crosswords, and stories are next.'
          : 'Free printable books you make at the kitchen table. Sudoku is ready. Bingo, crosswords, and stories are next.'}
      </p>

      <section className="shelf" aria-label="Books">
        <button className="book-sudoku" type="button" onClick={openSudokuMaker}>
          <span className="mini-grid" aria-hidden="true">
            {SAMPLE.map((value, index) => (
              <span key={index}>{value}</span>
            ))}
          </span>
          <span className="book-copy">
            <span className="kicker">Ready to print</span>
            <h2>Sudoku</h2>
            <p>Number puzzles in 4×4, 6×6, or 9×9. Choose a difficulty and how many puzzles, then download a letter-size PDF.</p>
            <span className="book-go">Make a Sudoku book</span>
          </span>
        </button>

        {anagramsEnabled ? (
          <button className="book-anagram" type="button" onClick={openAnagrams}>
            <span className="mini-words" aria-hidden="true">
              <span>C T A</span>
              <span>G O D</span>
              <span>S N U</span>
              <span>H T A</span>
            </span>
            <span className="book-copy">
              <span className="kicker">Ready to print</span>
              <h2>Anagrams</h2>
              <p>Scrambled words for kids to solve. Pick a difficulty, or type 5–8 of your own words, then print a letter-size worksheet.</p>
              <span className="book-go">Make an anagram sheet</span>
            </span>
          </button>
        ) : null}

        <div className="soon-row">
          <article className="book-soon">
            <span className="stamp">Soon</span>
            <h2>Bingo</h2>
            <p>Picture and number cards for a loud living-room game.</p>
          </article>
          <article className="book-soon">
            <span className="stamp">Soon</span>
            <h2>Crossword</h2>
            <p>Short clues and big squares, written for new readers.</p>
          </article>
          <article className="book-soon">
            <span className="stamp">Soon</span>
            <h2>Stories</h2>
            <p>Custom reading books, made one child at a time.</p>
          </article>
        </div>
      </section>
      <DailySubscribe placement="library" />
    </main>
  )
}
