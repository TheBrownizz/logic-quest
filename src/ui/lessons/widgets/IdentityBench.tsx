import type { WidgetProps } from './types'
import { WidgetStub } from './Stub'
import type { IdentityBenchConfig, IdentityBenchGoal, IdentityBenchState } from './identityBenchLogic'

/** IdentityBench widget (stub — replaced by its lessons task). */
export function IdentityBench(_props: WidgetProps<IdentityBenchConfig, IdentityBenchState, IdentityBenchGoal>) {
  return <WidgetStub name="IdentityBench" />
}
