import type { ReactNode } from 'react'
import type { Hint } from '../../content/types'
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

/** "Start over": a room's local state is reset by its parent (remount); see restartRoom for the save. */
export function RestartButton({ onRestart }: { onRestart: () => void }) {
  return <button type="button" className="btn ghost" onClick={onRestart}>התחל מחדש</button>
}

export function Hints({ hints, shown, onReveal }: { hints: Hint[]; shown: number; onReveal: () => void }) {
  if (hints.length === 0) return null
  return (
    <div className="hints">
      {hints.slice(0, shown).map((h, i) => <Prose key={i} as="p" className="hint" data-testid="hint" text={h.text}><span aria-hidden>💡</span> </Prose>)}
      {shown < hints.length && (
        <button type="button" className="btn ghost" onClick={onReveal}>
          רמז <span className="mono">{shown + 1}/{hints.length}</span>
          {shown === 0 && <span className="muted"> · מוותר על כוכב</span>}
        </button>
      )}
    </div>
  )
}

/** Shared "solved" panel for rooms that have no per-room extras. */
export function SolvedVerdict({ result, children }: { result?: RoomResult; children?: ReactNode }) {
  return (
    <div className="verdict good" role="status">
      <div className="verdict-head">
        <strong className="verdict-title">נכון!</strong>
        <Stars n={stars(result)} testId="result-stars" />
      </div>
      {children}
    </div>
  )
}

export const WRONG_TEXT = 'לא נכון, נסו שוב'
/** Wrong attempts after which the answer may be revealed. */
export const REVEAL_AFTER = 3
