import type { Figures } from './types'

/** Merges stage figure maps. Figure ids are global, so an id defined in two maps is reported, not overwritten. */
export function mergeFigures(maps: Figures[]): { figures: Figures; duplicates: string[] } {
  const figures: Figures = {}
  const duplicates: string[] = []
  for (const m of maps) for (const [id, svg] of Object.entries(m)) {
    if (id in figures) { if (!duplicates.includes(id)) duplicates.push(id) } else figures[id] = svg
  }
  return { figures, duplicates }
}
