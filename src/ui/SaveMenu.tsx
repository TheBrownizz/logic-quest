import { useEffect, useRef, useState } from 'react'
import { emptySave } from '../game/progress'
import { useAccount } from './account/AccountContext'
import { useSave, useSaveReplace, useSaveStore } from './save'

export function SaveMenu({ onClose }: { onClose: () => void }) {
  const [save] = useSave()
  const { store } = useSaveStore()
  const replace = useSaveReplace()
  const { user } = useAccount()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // An import reports success once the imported save is the one the app holds.
  const [imported, setImported] = useState(false)
  // The provider commits the replacement synchronously, so this render already holds the imported save.
  useEffect(() => {
    if (imported) { setMsg({ ok: true, text: 'השמירה נטענה בהצלחה' }); setImported(false) }
  }, [save, imported])
  const file = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panel.current?.focus()
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])

  const doExport = () => {
    const blob = new Blob([store.exportJSON(save)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'logic-quest-save.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setMsg({ ok: true, text: 'הקובץ הורד' })
  }

  const doImport = async (f: File | undefined) => {
    if (!f) return
    try {
      const r = store.importJSON(await f.text())
      if (r.ok) {
        if (user && !window.confirm('הייבוא יחליף את ההתקדמות בחשבון ובכל המכשירים המחוברים, ואי אפשר לבטל. להמשיך?')) return
        setMsg(null)
        replace(r.data)
        setImported(true)
      }
      else setMsg({ ok: false, text: 'הקובץ לא תקין, לא בוצע שינוי' })
    } catch {
      setMsg({ ok: false, text: 'קריאת הקובץ נכשלה' })
    }
    if (file.current) file.current.value = ''
  }

  const doReset = () => {
    const text = user ? 'למחוק את כל ההתקדמות, גם בחשבון ובכל המכשירים? אי אפשר לבטל.' : 'למחוק את כל ההתקדמות? אי אפשר לבטל.'
    if (!window.confirm(text)) return
    replace(emptySave())
    setMsg({ ok: true, text: 'ההתקדמות אופסה' })
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="שמירה" onClick={e => e.stopPropagation()}>
        <h2>שמירה</h2>
        <p className="muted">ההתקדמות נשמרת בדפדפן. אפשר לייצא קובץ גיבוי ולטעון אותו במכשיר אחר.</p>
        <div className="row">
          <button className="btn" onClick={doExport}>ייצוא</button>
          <button className="btn" onClick={() => file.current?.click()}>ייבוא</button>
          <button className="btn danger" onClick={doReset}>איפוס</button>
        </div>
        <input ref={file} type="file" accept=".json,application/json" hidden aria-label="קובץ שמירה" onChange={e => doImport(e.target.files?.[0])} />
        {msg && <p role="status" className={msg.ok ? 'ok' : 'err'}>{msg.text}</p>}
        <button className="btn ghost" onClick={onClose}>סגירה</button>
      </div>
    </div>
  )
}
