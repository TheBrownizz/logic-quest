import { useState } from 'react'
import { Prose } from '../../Prose'
import type { StepProps } from './types'

/** A multiple-choice check: a wrong option shows its own feedback and the player tries again, without penalty. */
export function CheckStep({ step, completed, onComplete }: StepProps<'check'>) {
  const [picked, setPicked] = useState<number | null>(completed ? step.correct : null)
  const [tried, setTried] = useState<number[]>([])
  const solved = completed || picked === step.correct
  const pick = (i: number) => {
    if (solved) return
    setPicked(i)
    if (i === step.correct) onComplete()
    else setTried(t => (t.includes(i) ? t : [...t, i]))
  }
  return (
    <div className="step-check">
      <Prose as="p" className="lesson-text lesson-q" text={step.prompt} />
      <div className="check-opts" role="group" aria-label="תשובות">
        {step.options.map((o, i) => {
          const state = solved && i === step.correct ? 'right' : tried.includes(i) ? 'wrong' : ''
          return (
            <button key={i} type="button" className={`check-opt ${state}`} data-testid={`check-opt-${i}`}
              aria-pressed={picked === i} disabled={solved && i !== step.correct} onClick={() => pick(i)}>
              <span className="check-mark" aria-hidden>{state === 'right' ? '✓' : state === 'wrong' ? '✗' : ''}</span>
              <Prose text={o} />
            </button>
          )
        })}
      </div>
      {picked !== null && (
        <div key={picked} className={`check-feedback ${picked === step.correct ? 'good' : 'bad'}`} data-testid="check-feedback"
          role={picked === step.correct ? 'status' : 'alert'}>
          <strong>{picked === step.correct ? 'נכון!' : 'לא בדיוק.'}</strong> <Prose text={step.feedback[picked]} />
          {picked !== step.correct && <span className="muted"> נסו תשובה אחרת.</span>}
        </div>
      )}
    </div>
  )
}
