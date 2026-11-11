import { fw } from '@fireweaveai/web-sdk/start'
import { useEffect, useState } from 'react'
import { LIBRARY_TITLE } from './seo.ts'
import { AnagramMaker } from './ui/AnagramMaker.tsx'
import { Library } from './ui/Library.tsx'
import { SudokuMaker } from './ui/SudokuMaker.tsx'

type Screen = 'library' | 'sudoku' | 'anagrams'

export default function App() {
  // @fireweave-controlpoint anagram-sheets
  const anagramsEnabled = fw.controlPoints.getBooleanValue('anagram-sheets', false)
  const [screen, setScreen] = useState<Screen>('library')
  const visibleScreen: Screen = screen === 'anagrams' && !anagramsEnabled ? 'library' : screen

  useEffect(() => {
    if (visibleScreen === 'library') document.title = LIBRARY_TITLE
  }, [visibleScreen])

  if (visibleScreen === 'sudoku') {
    return <SudokuMaker onBack={() => setScreen('library')} />
  }
  if (visibleScreen === 'anagrams') {
    return <AnagramMaker onBack={() => setScreen('library')} />
  }
  return <Library onOpen={setScreen} anagramsEnabled={anagramsEnabled} />
}
