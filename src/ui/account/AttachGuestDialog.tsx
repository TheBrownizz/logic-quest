import { useDialog } from './useDialog'

export function AttachGuestDialog({ email, onAttach, onKeep }: { email: string; onAttach: () => void; onKeep: () => void }) {
  const panel = useDialog(onKeep) // Escape keeps the progress as the guest's: the safe answer
  return (
    <div className="overlay">
      <div className="panel" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="attach-title" data-testid="attach-dialog">
        <h2 id="attach-title">לצרף את ההתקדמות מהמכשיר הזה לחשבון?</h2>
        <p className="muted">נמצאה במכשיר הזה התקדמות של אורח. אפשר לצרף אותה לחשבון <bdi dir="ltr">{email}</bdi>, או להשאיר אותה כאורח בלבד.</p>
        <div className="row">
          <button className="btn primary" onClick={onAttach}>צרף</button>
          <button className="btn" onClick={onKeep}>השאר כאורח</button>
        </div>
      </div>
    </div>
  )
}
