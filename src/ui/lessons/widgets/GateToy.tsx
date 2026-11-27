import type { WidgetProps } from './types'
import { WidgetStub } from './Stub'
import type { GateToyConfig, GateToyGoal, GateToyState } from './gateToyLogic'

/** GateToy widget (stub — replaced by its lessons task). */
export function GateToy(_props: WidgetProps<GateToyConfig, GateToyState, GateToyGoal>) {
  return <WidgetStub name="GateToy" />
}
