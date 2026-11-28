import type { LabPuzzle, World } from '../../content/types'
import { CodePuzzle } from './CodePuzzle'
import { DelayPuzzle } from './DelayPuzzle'
import { FsmEquationsPuzzle } from './FsmEquationsPuzzle'
import { IdentifyPuzzle } from './IdentifyPuzzle'
import { KMapPuzzle } from './KMapPuzzle'
import { CircuitPuzzleView } from './LabRoom'
import { NumberPuzzle } from './NumberPuzzle'
import type { PuzzleHost } from './roomParts'
import { StateReducePuzzle } from './StateReducePuzzle'
import { StateTablePuzzle } from './StateTablePuzzle'
import { WaveformPuzzle } from './WaveformPuzzle'
import './seq.css'

/**
 * Any lab puzzle, in a room, a lesson `try` step or an exam part. `room` only matters to circuit puzzles
 * (drafts, the player's chips, autofill). Give it a `key` that changes to start the puzzle over.
 */
export function PuzzleView({ host, puzzle, world, room }: { host: PuzzleHost; puzzle: LabPuzzle; world?: World; room?: { id: string; autofill: boolean } }) {
  switch (puzzle.type) {
    case 'circuit': return <CircuitPuzzleView host={host} puzzle={puzzle} room={room} />
    case 'delay': return <DelayPuzzle host={host} puzzle={puzzle} world={world} />
    case 'kmap': return <KMapPuzzle host={host} puzzle={puzzle} />
    case 'number': return <NumberPuzzle host={host} puzzle={puzzle} />
    case 'code': return <CodePuzzle host={host} puzzle={puzzle} />
    case 'state-table': return <StateTablePuzzle host={host} puzzle={puzzle} />
    case 'fsm-equations': return <FsmEquationsPuzzle host={host} puzzle={puzzle} />
    case 'waveform': return <WaveformPuzzle host={host} puzzle={puzzle} />
    case 'state-reduce': return <StateReducePuzzle host={host} puzzle={puzzle} />
    case 'identify': return <IdentifyPuzzle host={host} puzzle={puzzle} />
  }
}
