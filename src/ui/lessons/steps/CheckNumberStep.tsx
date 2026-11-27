import { useState, type FormEvent } from 'react'
import { Prose } from '../../Prose'
import { matchesAnswer } from '../player'
import type { StepProps } from './types'

export function CheckNumberStep({ step, completed, onComplete }: StepProps<'check-number'>) {
  const [value, setValue] = useState(completed ? step.answer : '')
  const [wrong, setWrong] = useState(0)
  const [solved, setSolved] = useState(completed)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (solved || value.trim() === '') return
    if (matchesAnswer(value, step.answer)) { setSolved(true); onComplete() }
    else setWrong(w => w + 1)
  }
  return (
    <form className="step-check-number" onSubmit={submit}>
      <Prose as="label" htmlFor={`cn-${step.id}`} className="lesson-text lesson-q" text={step.prompt} />
      <div className="num-row">
        <input id={`cn-${step.id}`} data-testid="check-number-input" className="mono num-input" dir="ltr" autoComplete="off"
          spellCheck={false} value={value} disabled={solved} placeholder="…"
          onChange={e => { setValue(e.target.value); setWrong(0) }} />
        <button type="submit" className="btn" disabled={solved}>בדוק</button>
      </div>
      {solved && <div className="check-feedback good" role="status" data-testid="check-feedback"><strong>נכון!</strong></div>}
      {!solved && wrong > 0 && (
        <div key={wrong} className="check-feedback bad" role="alert" data-testid="check-feedback">
          <strong>לא בדיוק.</strong> <Prose text={step.feedbackWrong} />
        </div>
      )}
    </form>
  )
}
