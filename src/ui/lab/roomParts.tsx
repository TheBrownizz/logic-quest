import type { Hint } from '../../content/types'
import type { RoomResult, SaveData } from '../../game/progress'
import { useSave } from '../save'
import { mergeResult } from './labLogic'

/** Saves a solved result, keeping the best of each flag. Returns the merged result. */
export function useSolve(roomId: string) {
  const [save, update] = useSave()
  return (cur: RoomResult, extra?: (d: SaveData) => SaveData) => {
    const merged = mergeResult(save.rooms[roomId], cur)
    update(d => {
      const next = { ...d, rooms: { ...d.rooms, [roomId]: mergeResult(d.rooms[roomId], cur) } }
      return extra ? extra(next) : next
    })
    return merged
  }
}

export function Hints({ hints, shown, onReveal }: { hints: Hint[]; shown: number; onReveal: () => void }) {
  if (hints.length === 0) return null
  return (
    <div className="hints">
      {hints.slice(0, shown).map((h, i) => <p key={i} className="hint" data-testid="hint"><span aria-hidden>💡</span> {h.text}</p>)}
      {shown < hints.length && (
        <button type="button" className="btn ghost" onClick={onReveal}>
          רמז <span className="mono">{shown + 1}/{hints.length}</span>
          {shown === 0 && <span className="muted"> · מוותר על כוכב</span>}
        </button>
      )}
    </div>
  )
}
