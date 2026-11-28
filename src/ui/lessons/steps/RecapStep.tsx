import { Prose } from '../../Prose'
import type { StepProps } from './types'

/** The lesson's finish screen body: what was learned (LessonScreen adds the way on). */
export function RecapStep({ step }: StepProps<'recap'>) {
  return (
    <div className="step-recap">
      <div className="finish-badge" aria-hidden>✓</div>
      <h2 className="finish-title">סיימתם את השיעור</h2>
      <h3 className="finish-sub">מה למדתם</h3>
      <ul className="recap-points" data-testid="recap-points">
        {step.points.map((p, i) => <Prose key={i} as="li" text={p} />)}
      </ul>
    </div>
  )
}
