import { useState } from 'react'
import type { Card } from '../../content/types'
import { useSave } from '../save'

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו']

export function FlagButton({ id }: { id: string }) {
  const [save, update] = useSave()
  const on = save.flagged.includes(id)
  const toggle = () => update(d => ({ ...d, flagged: d.flagged.includes(id) ? d.flagged.filter(x => x !== id) : [...d.flagged, id] }))
  return (
    <button type="button" className={`flag${on ? ' on' : ''}`} aria-pressed={on} onClick={toggle}>
      {on ? 'סומן ✓' : '⚑ נראה שגוי'}
    </button>
  )
}

export function Reveal({ card, correct, examReason }: { card: Card; correct: boolean; examReason?: string }) {
  return (
    <div className={`reveal ${correct ? 'good' : 'bad'}`} data-testid="reveal" role="status">
      <p className="v-label">{correct ? 'נכון!' : 'לא נכון'}</p>
      {examReason && (
        <p className="exam"><b>ככה כותבים במבחן:</b> <span dir="auto">{examReason}</span></p>
      )}
      {!correct && (
        <div className="knowledge flip" data-testid="knowledge">
          <span className="k-label">קלף ידע חדש</span>
          <p dir="auto">{card.knowledge}</p>
          <span className="source muted" dir="auto">{card.source}</span>
        </div>
      )}
    </div>
  )
}

/**
 * One card of a run. `order` is the display order of the claim's reasons (indices into card.reasons).
 * onReveal fires once when the answer is locked in; onNext when the player moves on.
 */
export function CardView({ card, order, onReveal, onNext }: {
  card: Card
  order: number[]
  onReveal: (correct: boolean) => void
  onNext: (correct: boolean) => void
}) {
  const [verdict, setVerdict] = useState<boolean | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const revealed = picked !== null
  const correct = card.kind === 'claim'
    ? verdict === card.isTrue && picked === card.correctReason
    : picked === card.correct

  const pick = (i: number) => {
    if (revealed) return
    setPicked(i)
    onReveal(card.kind === 'claim' ? verdict === card.isTrue && i === card.correctReason : i === card.correct)
  }

  return (
    <article className="card" data-kind={card.kind}>
      <div className="card-top"><span className="kind">{card.kind === 'claim' ? 'טענה' : 'שאלה'}</span><FlagButton id={card.id} /></div>
      <p className="card-text" dir="auto">{card.text}</p>

      {card.kind === 'claim' ? (
        <>
          <div className="verdicts">
            {([true, false] as const).map(v => (
              <button key={String(v)} type="button" data-testid={`verdict-${v}`} disabled={verdict !== null}
                className={`big ${v ? 'yes' : 'no'}${verdict === v ? ' chosen' : ''}`} onClick={() => setVerdict(v)}>
                {v ? 'נכונה' : 'לא נכונה'}
              </button>
            ))}
          </div>
          {verdict !== null && (
            <div className="reasons" role="group" aria-label="הנימוק">
              <p className="muted step">למה?</p>
              {order.map(i => (
                <button key={i} type="button" data-testid={`opt-${i}`} disabled={revealed} onClick={() => pick(i)}
                  className={`opt${picked === i ? ' chosen' : ''}${revealed && i === card.correctReason ? ' right' : ''}${revealed && picked === i && i !== card.correctReason ? ' wrong' : ''}`}>
                  <span dir="auto">{card.reasons[i]}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="reasons" role="group" aria-label="תשובות">
          {card.options.map((o, i) => (
            <button key={i} type="button" data-testid={`opt-${i}`} disabled={revealed} onClick={() => pick(i)}
              className={`opt${picked === i ? ' chosen' : ''}${revealed && i === card.correct ? ' right' : ''}${revealed && picked === i && i !== card.correct ? ' wrong' : ''}`}>
              <span className="letter" aria-hidden>{LETTERS[i]}</span>
              <span dir="auto">{o}</span>
            </button>
          ))}
        </div>
      )}

      {revealed && (
        <>
          <Reveal card={card} correct={correct} examReason={card.kind === 'claim' ? card.examReason : undefined} />
          <button type="button" className="btn primary next" onClick={() => onNext(correct)} autoFocus>הבא</button>
        </>
      )}
    </article>
  )
}
