import { allFigures } from '../../../content/lessons/catalog'
import { Prose } from '../../Prose'
import type { StepProps } from './types'

export function ExplainStep({ step }: StepProps<'explain'>) {
  const fig = step.figure ? allFigures[step.figure] : undefined
  return (
    <div className="step-explain">
      <Prose as="p" className="lesson-text" text={step.text} />
      {/* figures are static SVG markup from the content files, checked by validateLessons */}
      {fig && <div className="lesson-figure" data-testid="lesson-figure" dangerouslySetInnerHTML={{ __html: fig }} />}
    </div>
  )
}
