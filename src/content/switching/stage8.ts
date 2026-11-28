import type { Stage } from '../types'
import { stage8Cards } from './stage8-cards'
import { stage8Rooms } from './stage8-rooms'

/** Stage 8 shell: Task 5 fills stage8-rooms.ts, stage8-cards.ts and lessons/stage8.ts. */
export const stage8: Stage = { id: 'sw-8-design', order: 8, title: 'תכנון וצמצום מכונות מצבים', rooms: stage8Rooms, cards: stage8Cards }
