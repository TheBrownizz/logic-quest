import type { Step, WidgetName } from './types'
import type * as baseDial from '../../ui/lessons/widgets/baseDialLogic'
import type * as baseConvert from '../../ui/lessons/widgets/baseConvertLogic'
import type * as complementLab from '../../ui/lessons/widgets/complementLabLogic'
import type * as bitField from '../../ui/lessons/widgets/bitFieldLogic'
import type * as gateToy from '../../ui/lessons/widgets/gateToyLogic'
import type * as identityBench from '../../ui/lessons/widgets/identityBenchLogic'
import type * as truthToMap from '../../ui/lessons/widgets/truthToMapLogic'
import type * as rippleTimeline from '../../ui/lessons/widgets/rippleTimelineLogic'
import type * as muxToy from '../../ui/lessons/widgets/muxToyLogic'

/**
 * The config, state and goal types of every widget, as pinned in each `<name>Logic.ts`. The registry is typed
 * against this map, so a widget implementation that drifts from its pinned types fails to compile.
 */
export interface WidgetTypes {
  BaseDial: { config: baseDial.BaseDialConfig; state: baseDial.BaseDialState; goal: baseDial.BaseDialGoal }
  BaseConvert: { config: baseConvert.BaseConvertConfig; state: baseConvert.BaseConvertState; goal: baseConvert.BaseConvertGoal }
  ComplementLab: { config: complementLab.ComplementLabConfig; state: complementLab.ComplementLabState; goal: complementLab.ComplementLabGoal }
  BitField: { config: bitField.BitFieldConfig; state: bitField.BitFieldState; goal: bitField.BitFieldGoal }
  GateToy: { config: gateToy.GateToyConfig; state: gateToy.GateToyState; goal: gateToy.GateToyGoal }
  IdentityBench: { config: identityBench.IdentityBenchConfig; state: identityBench.IdentityBenchState; goal: identityBench.IdentityBenchGoal }
  TruthToMap: { config: truthToMap.TruthToMapConfig; state: truthToMap.TruthToMapState; goal: truthToMap.TruthToMapGoal }
  RippleTimeline: { config: rippleTimeline.RippleTimelineConfig; state: rippleTimeline.RippleTimelineState; goal: rippleTimeline.RippleTimelineGoal }
  MuxToy: { config: muxToy.MuxToyConfig; state: muxToy.MuxToyState; goal: muxToy.MuxToyGoal }
}

export type ConfigOf<K extends WidgetName> = WidgetTypes[K]['config']
export type StateOf<K extends WidgetName> = WidgetTypes[K]['state']
export type GoalOf<K extends WidgetName> = WidgetTypes[K]['goal']

/** A widget step whose config, goal and example are checked at compile time against the widget's pinned types. */
export interface TypedWidgetStep<K extends WidgetName> {
  id: string
  prompt: string
  widget: K
  config: ConfigOf<K>
  goal?: GoalOf<K>
  /** A state that meets `goal`; required when `goal` is set (validateLessons checks it with isGoalMet). */
  example?: StateOf<K>
}

/**
 * Write every widget step through this helper in lesson files:
 * `widgetStep({ id: 'dial', prompt: '…', widget: 'BaseDial', config: { base: 2, width: 4 }, goal: { value: 5 }, example: { digits: [0, 1, 0, 1] } })`
 */
export function widgetStep<K extends WidgetName>(s: TypedWidgetStep<K>): Step {
  return { kind: 'widget', ...s }
}
