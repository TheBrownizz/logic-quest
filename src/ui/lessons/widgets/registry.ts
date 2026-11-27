import type { WidgetName } from '../../../content/lessons/types'
import type { WidgetDef } from './types'
import { BaseDial } from './BaseDial'
import * as baseDial from './baseDialLogic'
import { BaseConvert } from './BaseConvert'
import * as baseConvert from './baseConvertLogic'
import { ComplementLab } from './ComplementLab'
import * as complementLab from './complementLabLogic'
import { BitField } from './BitField'
import * as bitField from './bitFieldLogic'
import { GateToy } from './GateToy'
import * as gateToy from './gateToyLogic'
import { IdentityBench } from './IdentityBench'
import * as identityBench from './identityBenchLogic'
import { TruthToMap } from './TruthToMap'
import * as truthToMap from './truthToMapLogic'
import { RippleTimeline } from './RippleTimeline'
import * as rippleTimeline from './rippleTimelineLogic'
import { MuxToy } from './MuxToy'
import * as muxToy from './muxToyLogic'

type AnyDef = WidgetDef<any, any, any>

/**
 * Every lesson widget by name. Each entry wires `<Name>.tsx` (component) to `<name>Logic.ts` (initial, isGoalMet).
 * Lessons tasks replace those two files only; this file stays as it is.
 */
export const registry: Record<WidgetName, AnyDef> = {
  BaseDial: { Component: BaseDial, initial: baseDial.initial, isGoalMet: baseDial.isGoalMet },
  BaseConvert: { Component: BaseConvert, initial: baseConvert.initial, isGoalMet: baseConvert.isGoalMet },
  ComplementLab: { Component: ComplementLab, initial: complementLab.initial, isGoalMet: complementLab.isGoalMet },
  BitField: { Component: BitField, initial: bitField.initial, isGoalMet: bitField.isGoalMet },
  GateToy: { Component: GateToy, initial: gateToy.initial, isGoalMet: gateToy.isGoalMet },
  IdentityBench: { Component: IdentityBench, initial: identityBench.initial, isGoalMet: identityBench.isGoalMet },
  TruthToMap: { Component: TruthToMap, initial: truthToMap.initial, isGoalMet: truthToMap.isGoalMet },
  RippleTimeline: { Component: RippleTimeline, initial: rippleTimeline.initial, isGoalMet: rippleTimeline.isGoalMet },
  MuxToy: { Component: MuxToy, initial: muxToy.initial, isGoalMet: muxToy.isGoalMet },
}
