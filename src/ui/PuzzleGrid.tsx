import { BOX, type Size } from '../sudoku/model.ts'

export function PuzzleGrid({ grid, size }: { grid: number[][]; size: Size }) {
  const { rows, cols } = BOX[size]
  return (
    <div
      className="puzzle-grid"
      data-size={size}
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      aria-label={`${size} by ${size} puzzle preview`}
    >
      {grid.flatMap((row, r) =>
        row.map((value, c) => {
          const shadows = [
            c > 0 && c % cols === 0 ? 'inset 2.5px 0 0 var(--ink)' : c > 0 ? 'inset 1px 0 0 #d9cbb8' : '',
            r > 0 && r % rows === 0 ? 'inset 0 2.5px 0 var(--ink)' : r > 0 ? 'inset 0 1px 0 #d9cbb8' : '',
          ].filter(Boolean)
          return (
            <span key={`${r}-${c}`} className="puzzle-cell" style={{ boxShadow: shadows.join(', ') }}>
              {value || ''}
            </span>
          )
        }),
      )}
    </div>
  )
}
