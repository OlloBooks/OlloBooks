import { useEffect, useState } from 'react'
import { LIBRARY_TITLE } from './seo.ts'
import { Library } from './ui/Library.tsx'
import { SudokuMaker } from './ui/SudokuMaker.tsx'

export default function App() {
  const [screen, setScreen] = useState<'library' | 'sudoku'>('library')

  useEffect(() => {
    if (screen === 'library') document.title = LIBRARY_TITLE
  }, [screen])

  if (screen === 'sudoku') {
    return <SudokuMaker onBack={() => setScreen('library')} />
  }
  return <Library onOpen={() => setScreen('sudoku')} />
}
