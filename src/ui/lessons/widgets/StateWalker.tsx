import { useEffect } from 'react'
import type { WidgetProps } from './types'
import { WidgetStub } from './Stub'
import { initial, type StateWalkerConfig, type StateWalkerGoal, type StateWalkerState } from './stateWalkerLogic'

/** StateWalker widget (stub: its lessons task replaces this file; the types in stateWalkerLogic.ts are pinned). */
export function StateWalker({ config, onState }: WidgetProps<StateWalkerConfig, StateWalkerState, StateWalkerGoal>) {
  useEffect(() => { onState(initial(config)) }, [])
  return <WidgetStub name="StateWalker" />
}
