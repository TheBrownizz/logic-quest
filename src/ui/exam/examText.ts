import type { ExamTopic, World } from '../../content/types'

/** Topic names as the exam sheet groups them (spec 6.5). */
export const TOPIC_NAMES: Record<ExamTopic, string> = {
  1: 'מספרים, IEEE וקודים',
  2: 'מחברים ומינימיזציה',
  3: 'MUX, ROM ו-PLA',
  4: 'מערכות עקיבה',
}

/** The first world that has a boss (the switching world). */
export const bossWorld = (worlds: Array<{ world?: World }>): World | undefined => worlds.find(w => w.world?.boss)?.world

/** "mm:ss" of a duration in ms (minutes may pass 59: "150:00"), never negative. */
export function clock(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export const HEB_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו']
