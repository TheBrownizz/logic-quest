import type { Page } from '@playwright/test'
import { switchingWorld } from '../../src/content/switching/world'
import { emptySave, type SaveData } from '../../src/game/progress'

export const SAVE_KEY = 'logic-quest-save'

/** Writes `save` to localStorage once per tab (a reload keeps whatever the app saved since). */
export async function seed(page: Page, save: SaveData) {
  await page.addInitScript(([k, s]) => {
    if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, s); sessionStorage.setItem('seeded', '1') }
  }, [SAVE_KEY, JSON.stringify(save)] as const)
}

/**
 * A save in which every stage is open: all rooms of the stages before `uptoOrder` are solved,
 * except `except`. Seeded results carry no optimal or no-hints flags, so they never add stars.
 */
export function unlockedSave(except: string[] = [], uptoOrder = 5): SaveData {
  const save = emptySave()
  for (const s of switchingWorld.stages) if (s.order < uptoOrder) for (const r of s.rooms) {
    if (!except.includes(r.id)) save.rooms[r.id] = { solved: true, optimal: false, noHints: false }
  }
  return save
}

/** Reads the app's saved data in the page. */
export const readSave = (page: Page): Promise<SaveData> => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE_KEY)
