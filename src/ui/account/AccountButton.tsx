import { useEffect, useRef, useState } from 'react'
import { hrefs } from '../router'
import { useAccount } from './AccountContext'
import { DeleteAccountDialog } from './DeleteAccountDialog'
import { SyncBadge } from './SyncBadge'

/** The header's account control: "sign in with Google" for a guest; avatar, sync badge and menu once signed in. Nothing when accounts are off. */
export function AccountButton() {
  const { supported, user, status, busy, error, signIn, signOut } = useAccount()
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); toggle.current?.focus() } }
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown) }
  }, [open])

  if (!supported) return null
  if (!user) {
    return (
      <span className="row">
        <button className="btn" onClick={signIn} disabled={busy === 'signin'}>{busy === 'signin' ? 'מתחבר…' : 'התחברות עם Google'}</button>
        {error && <span role="alert" className="err">{error}</span>}
      </span>
    )
  }
  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase()
  return (
    <div className="account" ref={box}>
      <SyncBadge status={status} />
      <button ref={toggle} className="btn ghost avatar-btn" aria-expanded={open} aria-controls="account-menu" aria-label={`החשבון של ${user.name}`} onClick={() => setOpen(o => !o)}>
        {user.avatar
          ? <img className="avatar" src={user.avatar} alt="" referrerPolicy="no-referrer" />
          : <span className="avatar" aria-hidden="true">{initial}</span>}
      </button>
      {open && (
        <div className="account-menu" id="account-menu">
          <p className="account-name">{user.name}</p>
          <p className="muted account-email">{user.email}</p>
          {error && <p role="alert" className="err">{error}</p>}
          <button className="btn ghost" onClick={signOut} disabled={busy === 'saving'}>{busy === 'saving' ? 'שומר…' : 'התנתקות'}</button>
          <button className="btn ghost danger" onClick={() => { setOpen(false); setConfirmDelete(true) }}>מחיקת חשבון</button>
          <a className="btn ghost" href={hrefs.privacy} onClick={() => setOpen(false)}>פרטיות</a>
        </div>
      )}
      {confirmDelete && <DeleteAccountDialog onClose={() => setConfirmDelete(false)} />}
    </div>
  )
}
