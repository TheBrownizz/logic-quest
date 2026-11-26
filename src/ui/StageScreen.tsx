import type { Stage } from '../content/types'
import { isStageUnlocked, stars } from '../game/rules'
import { hrefs } from './router'
import { useSave } from './save'
import { Stars } from './Stars'
import { findWorld } from './worlds'

const ordered = (stages: Stage[]) => [...stages].sort((a, b) => a.order - b.order)

export function WorldScreen({ worldId }: { worldId: string }) {
  const [save] = useSave()
  const world = findWorld(worldId)
  if (!world) return <NotFound />
  return (
    <section>
      <a className="back" href={hrefs.map}>→ למפה</a>
      <h1 className="title">{world.icon} {world.title}</h1>
      <ol className="path">
        {ordered(world.stages).map(s => {
          const unlocked = isStageUnlocked(world, s.id, save)
          const got = s.rooms.reduce((n, r) => n + stars(save.rooms[r.id]), 0)
          const inner = (
            <>
              <span className="node mono" aria-hidden>{unlocked ? s.order : '🔒'}</span>
              <span className="node-body">
                <span className="node-title">{s.title}</span>
                <span className="node-meta mono">
                  {unlocked ? <>{got}/{s.rooms.length * 3} ★</> : <span className="muted">נעול</span>}
                </span>
              </span>
            </>
          )
          return (
            <li key={s.id}>
              {unlocked
                ? <a className="stage-node" data-testid={`stage-${s.id}`} data-locked="false" href={hrefs.stage(world.id, s.id)}>{inner}</a>
                : <div className="stage-node locked" data-testid={`stage-${s.id}`} data-locked="true" aria-disabled="true">{inner}</div>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function StageScreen({ worldId, stageId }: { worldId: string; stageId: string }) {
  const [save] = useSave()
  const world = findWorld(worldId)
  const stage = world?.stages.find(s => s.id === stageId)
  if (!world || !stage) return <NotFound />
  const unlocked = isStageUnlocked(world, stage.id, save)
  return (
    <section>
      <a className="back" href={hrefs.world(world.id)}>→ {world.title}</a>
      <h1 className="title"><span className="mono accent">{stage.order}</span> {stage.title}</h1>
      {!unlocked ? (
        <div className="lock-note">
          <span aria-hidden>🔒</span>
          <p>השלב נעול. פתור 60% מהשלב הקודם כדי להיכנס.</p>
        </div>
      ) : (
        <>
          <a className="btn primary" href={hrefs.run(stage.id)}>ריצת חקירה</a>
          <h2 className="sub">חדרים</h2>
          <ul className="rooms">
            {stage.rooms.map(r => (
              <li key={r.id}>
                <a className="room-row" data-testid="room-row" href={hrefs.room(r.id)}>
                  <span className="room-title">{r.title}</span>
                  <Stars n={stars(save.rooms[r.id])} />
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

export function NotFound() {
  return (
    <section>
      <a className="back" href={hrefs.map}>→ למפה</a>
      <h1 className="title">לא נמצא</h1>
    </section>
  )
}
