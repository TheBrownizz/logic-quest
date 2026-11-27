import type { WidgetProps } from './types'
import { WidgetStub } from './Stub'
import type { BaseDialConfig, BaseDialGoal, BaseDialState } from './baseDialLogic'

/** BaseDial widget (stub — replaced by its lessons task). */
export function BaseDial(_props: WidgetProps<BaseDialConfig, BaseDialState, BaseDialGoal>) {
  return <WidgetStub name="BaseDial" />
}
