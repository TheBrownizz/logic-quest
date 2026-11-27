import type { WidgetProps } from './types'
import { WidgetStub } from './Stub'
import type { BaseConvertConfig, BaseConvertGoal, BaseConvertState } from './baseConvertLogic'

/** BaseConvert widget (stub — replaced by its lessons task). */
export function BaseConvert(_props: WidgetProps<BaseConvertConfig, BaseConvertState, BaseConvertGoal>) {
  return <WidgetStub name="BaseConvert" />
}
