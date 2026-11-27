import type { WidgetProps } from './types'
import { WidgetStub } from './Stub'
import type { MuxToyConfig, MuxToyGoal, MuxToyState } from './muxToyLogic'

/** MuxToy widget (stub — replaced by its lessons task). */
export function MuxToy(_props: WidgetProps<MuxToyConfig, MuxToyState, MuxToyGoal>) {
  return <WidgetStub name="MuxToy" />
}
