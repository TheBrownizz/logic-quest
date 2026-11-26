import type { World } from '../content/types'
import { switchingWorld } from '../content/switching/world'

export interface WorldEntry { id: string; title: string; icon: string; world?: World }

export const worlds: WorldEntry[] = [
  { id: switchingWorld.id, title: switchingWorld.title, icon: switchingWorld.icon, world: switchingWorld },
  { id: 'physics1', title: 'פיזיקה 1', icon: '🪐' },
  { id: 'linear-algebra', title: 'אלגברה לינארית', icon: '🧮' },
  { id: 'calculus1', title: 'חשבון אינפיניטסימלי 1', icon: '∫' },
  { id: 'c-programming', title: 'תכנות C', icon: '⌨️' },
]

export const findWorld = (id: string): World | undefined => worlds.find(w => w.id === id)?.world
