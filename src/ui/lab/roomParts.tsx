import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { Hint, Room } from '../../content/types'
import type { RoomResult, SaveData } from '../../game/progress'
import { stars } from '../../game/rules'
import { useSave } from '../save'
import { Prose } from '../Prose'
import { Stars } from '../Stars'
import { mergeResult } from './labLogic'

/**
 * Saves a solved result, keeping the best of each flag, and returns the merged result.
 * The room's `helped` mark stays set: only starting the room over (restartRoom) clears it.
 */
export function useSolve(roomId: string) {
  const [, update] = useSave()
  return (cur: RoomResult, extra?: (d: SaveData) => SaveData) => {
    let merged = cur
    update(d => {
      merged = mergeResult(d.rooms[roomId], cur)
      const next = { ...d, rooms: { ...d.rooms, [roomId]: merged } }
      return extra ? extra(next) : next
    })
    return merged
  }
}

/** Whether help was used in this room since the player last started it over (persisted, so a reload can't hide it). */
export function useHelped(roomId: string): [boolean, () => void] {
  const [save, update] = useSave()
  const mark = () => update(d => (d.helped[roomId] ? d : { ...d, helped: { ...d.helped, [roomId]: true } }))
  return [!!save.helped[roomId], mark]
}

/**
 * What a puzzle needs from the place it is played in: a lab room (saved, starred) or a lesson's `try` step
 * (nothing saved, no stars, no `helped`, no drafts).
 */
export interface PuzzleHost {
  hints: Hint[]
  /** Help used (a hint, a revealed answer). In a room it is persisted and costs the no-hints star. */
  helped: boolean
  markHelped: () => void
  /** Records a solve; returns the merged result to show stars for, or undefined where there are no stars. */
  solve: (cur: RoomResult, extra?: (d: SaveData) => SaveData) => RoomResult | undefined
  /** Whether this host gives stars (labels say "מוותר על כוכב" only then). */
  stars: boolean
  /** Remounts the puzzle with fresh local state ("התחל מחדש"). */
  onRestart: () => void
  /** A mock-exam part: no "show the answer", and choice puzzles take one answer only. */
  exam?: boolean
}

/** A lab room: solves and help are saved under the room's id. */
export function useRoomHost(room: Room, onRestart: () => void): PuzzleHost {
  const solve = useSolve(room.id)
  const [helped, markHelped] = useHelped(room.id)
  return { hints: room.hints, helped, markHelped, solve, stars: true, onRestart }
}

/** A lesson `try` step: nothing is saved; a solve only calls `onSolved`. */
export function useTryHost(hints: Hint[], onSolved: () => void, onRestart: () => void): PuzzleHost {
  const [helped, setHelped] = useState(false)
  const markHelped = useCallback(() => setHelped(true), [])
  return useMemo(() => ({
    hints, helped, markHelped, stars: false, onRestart,
    solve: () => { onSolved(); return undefined },
  }), [hints, helped, markHelped, onSolved, onRestart])
}

/** "Start over": a room's local state is reset by its parent (remount); see restartRoom for the save. */
export function RestartButton({ onRestart }: { onRestart: () => void }) {
  return <button type="button" className="btn ghost" onClick={onRestart}>התחל מחדש</button>
}

export function Hints({ hints, shown, onReveal, costsStar = true }: { hints: Hint[]; shown: number; onReveal: () => void; costsStar?: boolean }) {
  if (hints.length === 0) return null
  return (
    <div className="hints">
      {hints.slice(0, shown).map((h, i) => <Prose key={i} as="p" className="hint" data-testid="hint" text={h.text}><span aria-hidden>💡</span> </Prose>)}
      {shown < hints.length && (
        <button type="button" className="btn ghost" onClick={onReveal}>
          רמז <span className="mono">{shown + 1}/{hints.length}</span>
          {shown === 0 && costsStar && <span className="muted"> · מוותר על כוכב</span>}
        </button>
      )}
    </div>
  )
}

/** The hints panel of a host, revealing one hint at a time. */
export function HostHints({ host }: { host: PuzzleHost }) {
  const [shown, setShown] = useState(0)
  return <Hints hints={host.hints} shown={shown} costsStar={host.stars} onReveal={() => { setShown(s => s + 1); host.markHelped() }} />
}

/** Whether a puzzle may offer "show the answer" after REVEAL_AFTER misses (never in an exam). */
export const canReveal = (host: PuzzleHost, wrong: number) => !host.exam && wrong >= REVEAL_AFTER

/** The "show the answer" button's note: it costs a star only where there are stars. */
export const revealNote = (host: PuzzleHost) => (host.stars ? <span className="muted"> · מוותר על כוכב</span> : null)

/** Shared "solved" panel for rooms that have no per-room extras. */
/** Stars are shown only for a saved result (rooms). */
export function SolvedVerdict({ result, children }: { result?: RoomResult; children?: ReactNode }) {
  return (
    <div className="verdict good" role="status">
      <div className="verdict-head">
        <strong className="verdict-title">נכון!</strong>
        {result && <Stars n={stars(result)} testId="result-stars" />}
      </div>
      {children}
    </div>
  )
}

export const WRONG_TEXT = 'לא נכון, נסו שוב'
/** Wrong attempts after which the answer may be revealed. */
export const REVEAL_AFTER = 3
