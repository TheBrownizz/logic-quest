import type { ExamTopic, World } from '../../content/types'

/** Topic names as the exam sheet groups them (spec 6.5). */
export const TOPIC_NAMES: Record<ExamTopic, string> = {
  1: 'מספרים, IEEE וקודים',
  2: 'מחברים ומינימיזציה',
  3: 'MUX ו-ROM/PLA',
  4: 'מערכות עקיבה',
}

/** The first world that has a boss (the switching world). */
export const bossWorld = (worlds: Array<{ world?: World }>): World | undefined => worlds.find(w => w.world?.boss)?.world

/** "mm:ss" (or "h:mm:ss") of a duration in ms, never negative. */
export function clock(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export const HEB_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו']
