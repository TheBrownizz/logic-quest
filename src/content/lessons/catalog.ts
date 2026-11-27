import type { Figures, Lesson } from './types'
import { lessonsByStage, switchingFigureDuplicates, switchingFigures, switchingLessons } from '../switching/lessons'

/** Every lesson of every world. */
export const allLessons: Lesson[] = [...switchingLessons]

/** Every world's lesson figures. */
export const allFigures: Figures = { ...switchingFigures }

/** Figure ids defined more than once across the lesson files (must stay empty). */
export const figureDuplicates: string[] = [...switchingFigureDuplicates]

/** A stage's lessons in play order ([] for a stage without lessons or an unknown id). */
export function lessonsForStage(stageId: string): Lesson[] {
  return lessonsByStage[stageId] ?? []
}

export function findLesson(lessonId: string): Lesson | undefined {
  return allLessons.find(l => l.id === lessonId)
}
