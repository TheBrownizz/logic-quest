import { useEffect } from 'react'
import type { WidgetProps } from './types'
import { WidgetStub } from './Stub'
import { initial, type LatchToyConfig, type LatchToyGoal, type LatchToyState } from './latchToyLogic'

/** LatchToy widget (stub: its lessons task replaces this file; the types in latchToyLogic.ts are pinned). */
export function LatchToy({ config, onState }: WidgetProps<LatchToyConfig, LatchToyState, LatchToyGoal>) {
  useEffect(() => { onState(initial(config)) }, [])
  return <WidgetStub name="LatchToy" />
}
