import { useEffect } from 'react'
import type { WidgetProps } from './types'
import { WidgetStub } from './Stub'
import { initial, type ClockScopeConfig, type ClockScopeGoal, type ClockScopeState } from './clockScopeLogic'

/** ClockScope widget (stub: its lessons task replaces this file; the types in clockScopeLogic.ts are pinned). */
export function ClockScope({ config, onState }: WidgetProps<ClockScopeConfig, ClockScopeState, ClockScopeGoal>) {
  useEffect(() => { onState(initial(config)) }, [])
  return <WidgetStub name="ClockScope" />
}
