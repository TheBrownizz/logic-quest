import { useState } from 'react'
import { useSave } from '../save'
import { useAccount } from './AccountContext'

const KEY = 'lq-ui:nudge-dismissed'
const read = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }

/** Shown once to a guest after 3 solved rooms; dismissing it (or signing in) means it never comes back. */
export function GuestNudge() {
  const { supported, user, signIn, busy } = useAccount()
  const [save] = useSave()
  const [gone, setGone] = useState(read)
  const solved = Object.values(save.rooms).filter(r => r.solved).length
  if (!supported || user || gone || solved < 3) return null
  const dismiss = () => { try { localStorage.setItem(KEY, '1') } catch { /* ignore */ } setGone(true) }
  return (
    <aside className="nudge" role="note" data-testid="guest-nudge">
      <span>התחבר כדי לשמור את ההתקדמות בכל מכשיר</span>
      <span className="row">
        <button className="btn" onClick={signIn} disabled={busy === 'signin'}>התחברות עם Google</button>
        <button className="btn ghost" onClick={dismiss} aria-label="סגירת ההודעה">סגירה</button>
      </span>
    </aside>
  )
}
