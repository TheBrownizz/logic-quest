import type { WidgetProps } from './types'
import { WidgetStub } from './Stub'
import type { BitFieldConfig, BitFieldGoal, BitFieldState } from './bitFieldLogic'

/** BitField widget (stub — replaced by its lessons task). */
export function BitField(_props: WidgetProps<BitFieldConfig, BitFieldState, BitFieldGoal>) {
  return <WidgetStub name="BitField" />
}
