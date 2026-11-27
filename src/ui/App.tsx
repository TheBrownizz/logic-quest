import { useEffect, useState } from 'react'
import { rememberOpenStages } from '../game/lessonRules'
import type { ProgressStore, SaveData } from '../game/progress'
import { LabRoom } from './lab/LabRoom'
import { LessonScreen } from './lessons/LessonScreen'
import { MapScreen } from './MapScreen'
import { Collection } from './run/Collection'
import { RunScreen } from './run/RunScreen'
import { SaveMenu } from './SaveMenu'
import { NotFound, StageScreen, WorldScreen } from './StageScreen'
import { hrefs, useRoute } from './router'
import { SaveProvider, useSave } from './save'
import { worlds } from './worlds'
import './theme.css'

function Screen() {
  const r = useRoute()
  switch (r.name) {
    case 'map': return <MapScreen />
    case 'world': return <WorldScreen worldId={r.worldId} />
    case 'stage': return <StageScreen worldId={r.worldId} stageId={r.stageId} />
    case 'room': return <LabRoom key={r.roomId} roomId={r.roomId} />
    case 'run': return <RunScreen key={r.stageId} stageId={r.stageId} />
    case 'lesson': return <LessonScreen key={r.lessonId} lessonId={r.lessonId} stepId={r.stepId} />
    case 'collection': return <Collection />
    default: return <NotFound />
  }
}

/** Every world's stages opened by finished lessons, recorded in the save (see rememberOpenStages). */
const rememberAll = (d: SaveData): SaveData => worlds.reduce((acc, w) => (w.world ? rememberOpenStages(w.world, acc) : acc), d)

/**
 * Keeps `openStages` up to date whenever the save changes from outside the lesson player (load, import,
 * another tab), so an unlock earned under the current lessons stays when lessons are added later.
 */
function OpenStagesKeeper() {
  const [save, update] = useSave()
  useEffect(() => {
    if (rememberAll(save) !== save) update(rememberAll)
  }, [save, update])
  return null
}

export function App({ store }: { store?: ProgressStore }) {
  const [menu, setMenu] = useState(false)
  return (
    <SaveProvider store={store}>
      <OpenStagesKeeper />
      <header className="topbar">
        <a className="brand mono" href={hrefs.map}>Logic<span className="accent">Quest</span></a>
        <nav className="row">
          <a className="btn ghost" href={hrefs.collection}>אוסף</a>
          <button className="btn ghost" onClick={() => setMenu(true)}>שמירה</button>
        </nav>
      </header>
      <main className="main"><Screen /></main>
      {menu && <SaveMenu onClose={() => setMenu(false)} />}
    </SaveProvider>
  )
}
