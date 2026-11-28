import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAccount } from './AccountContext'
import { useDialog } from './useDialog'

export const DELETE_WORD = 'מחק'

export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const { deleteAccount, busy, error } = useAccount()
  const [typed, setTyped] = useState('')
  const panel = useDialog(onClose)
  const go = async () => {
    try { await deleteAccount(); onClose() } catch { /* the error is shown below */ }
  }
  // In a portal: the header's backdrop-filter would otherwise become the containing block of the fixed overlay.
  return createPortal(
    <div className="overlay" onClick={busy ? undefined : onClose}>
      <div className="panel" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="del-title" data-testid="delete-dialog" onClick={e => e.stopPropagation()}>
        <h2 id="del-title">מחיקת חשבון</h2>
        <p>הפעולה מוחקת את החשבון ואת ההתקדמות ששמורה בענן. ההתקדמות של האורח במכשיר הזה לא נפגעת. אי אפשר לבטל.</p>
        <label className="field">
          <span>להמשך, יש להקליד: <strong>{DELETE_WORD}</strong></span>
          <input className="input" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" aria-label="אישור מחיקה" />
        </label>
        {error && <p role="alert" className="err">{error}</p>}
        <div className="row">
          <button className="btn danger" disabled={typed.trim() !== DELETE_WORD || busy === 'deleting'} onClick={go}>
            {busy === 'deleting' ? 'מוחק…' : 'מחיקה לצמיתות'}
          </button>
          <button className="btn ghost" onClick={onClose} disabled={busy === 'deleting'}>ביטול</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
