import { useCallback, useEffect } from 'react'
import { Prose } from '../../Prose'
import { registry } from '../widgets/registry'
import type { StepProps } from './types'

/** A widget with an instruction. With a `goal`, the step completes when the widget's state meets it. */
export function WidgetStep({ step, completed, onComplete, reducedMotion, autofill }: StepProps<'widget'>) {
  const def = registry[step.widget]
  const hasGoal = step.goal !== undefined
  const onState = useCallback((s: unknown) => {
    if (!hasGoal) return
    try { if (def.isGoalMet(s, step.goal, step.config)) onComplete() } catch { /* a bad state never completes */ }
  }, [def, hasGoal, step.goal, step.config, onComplete])
  useEffect(() => { if (autofill && hasGoal) onComplete() }, [])
  const W = def.Component
  return (
    <div className="step-widget">
      <Prose as="p" className="lesson-text lesson-q" text={step.prompt} />
      <div className="widget-area" data-testid="widget-area" data-widget={step.widget}>
        <W config={step.config} goal={step.goal} onState={onState} reducedMotion={reducedMotion} />
      </div>
      {hasGoal && (
        <p className={`goal-line ${completed ? 'ok' : 'muted'}`} data-testid="goal-status" role="status">
          {completed ? '✓ המטרה הושגה' : 'המשיכו עד שהמטרה מתקיימת'}
        </p>
      )}
    </div>
  )
}
