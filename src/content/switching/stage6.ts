import type { Stage } from '../types'
import { stage6Cards } from './stage6-cards'
import { stage6Rooms } from './stage6-rooms'

/** Stage 6 shell: Task 3 fills stage6-rooms.ts, stage6-cards.ts and lessons/stage6.ts. */
export const stage6: Stage = { id: 'sw-6-latches', order: 6, title: 'Latches ודלגלגים', rooms: stage6Rooms, cards: stage6Cards }
