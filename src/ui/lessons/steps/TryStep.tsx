import { useCallback, useEffect, useState } from 'react'
import { Prose } from '../../Prose'
import { CircuitPuzzleView } from '../../lab/LabRoom'
import { CodePuzzle } from '../../lab/CodePuzzle'
import { DelayPuzzle } from '../../lab/DelayPuzzle'
import { KMapPuzzle } from '../../lab/KMapPuzzle'
import { NumberPuzzle } from '../../lab/NumberPuzzle'
import { useTryHost } from '../../lab/roomParts'
import type { StepProps } from './types'
import '../../lab/lab.css'

/** An embedded mini lab: the room's puzzle and checker, without stars, `helped` or drafts. */
export function TryStep({ step, completed, onComplete, autofill, world }: StepProps<'try'>) {
  const [attempt, setAttempt] = useState(0)
  const restart = useCallback(() => setAttempt(a => a + 1), [])
  const host = useTryHost(step.hints, onComplete, restart)
  useEffect(() => { if (autofill) onComplete() }, [])
  const pz = step.puzzle
  const key = `${step.id}#${attempt}`
  return (
    <div className="step-try" data-testid="try-step">
      <Prose as="p" className="lesson-text lesson-q" text={step.prompt} />
      {completed && <p className="goal-line ok" data-testid="try-done">✓ פתרתם את זה. אפשר להמשיך, או לנסות שוב.</p>}
      <div className={`try-lab lab try-${pz.type}`}>
        {pz.type === 'circuit' ? <CircuitPuzzleView key={key} host={host} puzzle={pz} />
          : pz.type === 'delay' ? <DelayPuzzle key={key} host={host} puzzle={pz} world={world} />
            : pz.type === 'kmap' ? <KMapPuzzle key={key} host={host} puzzle={pz} />
              : pz.type === 'number' ? <NumberPuzzle key={key} host={host} puzzle={pz} />
                : <CodePuzzle key={key} host={host} puzzle={pz} />}
      </div>
    </div>
  )
}
