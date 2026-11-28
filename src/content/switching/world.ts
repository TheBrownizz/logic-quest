import type { World } from '../types'
import { switchingBoss } from './boss'
import { stage1 } from './stage1'
import { stage2 } from './stage2'
import { stage3 } from './stage3'
import { stage4 } from './stage4'
import { stage5 } from './stage5'
import { stage6 } from './stage6'
import { stage7 } from './stage7'
import { stage8 } from './stage8'

export const switchingWorld: World = {
  id: 'switching',
  title: 'מיתוג ותכנון לוגי',
  icon: '🔲',
  stages: [stage1, stage2, stage3, stage4, stage5, stage6, stage7, stage8],
  boss: switchingBoss,
}
