import type { Boss } from '../types'
import { bossBank } from './boss-bank'

/** The switching world's boss (spec 6.1): opens by the 60% rule on the last stage; no lessons. */
export const switchingBoss: Boss = { id: 'sw-boss', title: 'מבחן הדמה', bank: bossBank }
