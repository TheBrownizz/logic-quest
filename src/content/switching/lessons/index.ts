import type { Figures, Lesson } from '../../lessons/types'
import * as stage1 from './stage1'
import * as stage2 from './stage2'
import * as stage3 from './stage3'
import * as stage4 from './stage4'
import * as stage5 from './stage5'

const files = [stage1, stage2, stage3, stage4, stage5]

/** Every switching lesson, stage files 1–5 in order. */
export const switchingLessons: Lesson[] = files.flatMap(f => f.lessons)

/** The switching lessons of each stage, sorted by `order`. */
export const lessonsByStage: Record<string, Lesson[]> = {}
for (const l of switchingLessons) (lessonsByStage[l.stage] ??= []).push(l)
for (const list of Object.values(lessonsByStage)) list.sort((a, b) => a.order - b.order)

/** Every stage file's figures in one map (figure ids are global, so prefix them with the stage, e.g. "s2-ieee"). */
export const switchingFigures: Figures = Object.assign({}, ...files.map(f => f.figures))
