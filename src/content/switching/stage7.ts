import type { Stage } from '../types'
import { stage7Cards } from './stage7-cards'
import { stage7Rooms } from './stage7-rooms'

/** Stage 7 shell: Task 4 fills stage7-rooms.ts, stage7-cards.ts and lessons/stage7.ts. */
export const stage7: Stage = { id: 'sw-7-fsm', order: 7, title: 'ניתוח מכונות מצבים', rooms: stage7Rooms, cards: stage7Cards }
