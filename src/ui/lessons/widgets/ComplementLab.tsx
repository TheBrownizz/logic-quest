import type { WidgetProps } from './types'
import { WidgetStub } from './Stub'
import type { ComplementLabConfig, ComplementLabGoal, ComplementLabState } from './complementLabLogic'

/** ComplementLab widget (stub — replaced by its lessons task). */
export function ComplementLab(_props: WidgetProps<ComplementLabConfig, ComplementLabState, ComplementLabGoal>) {
  return <WidgetStub name="ComplementLab" />
}
