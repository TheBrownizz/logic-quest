import type { Stage } from '../content/types'
import { isStageUnlocked, roomsToUnlock, stars } from '../game/rules'
import { lessonsForStage, stageRoomsOpen } from '../game/lessonRules'
import { LessonCard } from './lessons/LessonCard'
import { LessonsLockNote, LockNote, moreRooms } from './LockNote'
import { hrefs, queryParam } from './router'
import { useSave } from './save'
import { Stars } from './Stars'
import { findWorld } from './worlds'
import { bestExam, bossLocked, READY_SCORE } from '../game/exam'
import './exam/exam.css'

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
                  {unlocked ? <>{got}/{s.rooms.length * 3} ★</> : <span className="muted">נעול · {moreRooms(roomsToUnlock(world, s.id, save))}</span>}
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
        {world.boss && <BossNode world={world} />}
      </ol>
    </section>
  )
}

/** The boss after the last stage: its lock (60% of the last stage), the best score and "מוכן למבחן" at 80+. */
function BossNode({ world }: { world: NonNullable<ReturnType<typeof findWorld>> }) {
  const [save] = useSave()
  const boss = world.boss!
  const need = bossLocked(world, save)
  const best = bestExam(save)
  const inner = (
    <>
      <span className="node mono" aria-hidden>{need === 0 ? '🎓' : '🔒'}</span>
      <span className="node-body">
        <span className="node-title">{boss.title}</span>
        <span className="node-meta">
          {need > 0
            ? <span className="muted">נעול · {moreRooms(need)} בשלב האחרון</span>
            : best === undefined ? <span className="muted">עוד לא נבחנתם</span>
              : <><span className="mono" data-testid="boss-best-score">שיא {best}/100</span>{best >= READY_SCORE && <span className="ready-badge" data-testid="boss-ready">מוכן למבחן</span>}</>}
        </span>
      </span>
    </>
  )
  return (
    <li>
      {need === 0
        ? <a className="stage-node boss-node" data-testid="boss-node" data-locked="false" href={hrefs.boss}>{inner}</a>
        : <div className="stage-node boss-node locked" data-testid="boss-node" data-locked="true" aria-disabled="true">{inner}</div>}
    </li>
  )
}

export function StageScreen({ worldId, stageId }: { worldId: string; stageId: string }) {
  const [save] = useSave()
  const world = findWorld(worldId)
  const stage = world?.stages.find(s => s.id === stageId)
  if (!world || !stage) return <NotFound />
  const unlocked = isStageUnlocked(world, stage.id, save)
  const lessons = lessonsForStage(stage.id)
  const open = stageRoomsOpen(world, stage.id, save)
  // a lesson that just opened the rooms links here with ?unlocked=1: the rooms light up once
  const fresh = open && queryParam(window.location.search, window.location.hash, 'unlocked') === '1'
  return (
    <section>
      <a className="back" href={hrefs.world(world.id)}>→ {world.title}</a>
      <h1 className="title"><span className="mono accent">{stage.order}</span> {stage.title}</h1>
      {!unlocked ? (
        <LockNote world={world} stageId={stage.id} save={save} />
      ) : (
        <>
          {lessons.length > 0 && (
            <section className="learn" aria-labelledby="learn-h" data-testid="learn">
              <h2 className="sub" id="learn-h">למד</h2>
              <ol className="lessons">
                {lessons.map(l => <LessonCard key={l.id} lesson={l} save={save} recommended={open} />)}
              </ol>
            </section>
          )}
          <h2 className="sub">{lessons.length > 0 ? 'תרגל' : 'חדרים'}</h2>
          {open
            ? <a className="btn primary" href={hrefs.run(stage.id)}>ריצת חקירה</a>
            : <>
                <LessonsLockNote />
                <span className="btn primary locked" aria-disabled="true" data-testid="run-locked">🔒 ריצת חקירה</span>
              </>}
          <ul className={`rooms${open ? '' : ' locked'}${fresh ? ' just-unlocked' : ''}`} data-testid="rooms">
            {stage.rooms.map(r => (
              <li key={r.id}>
                {open
                  ? <a className="room-row" data-testid="room-row" href={hrefs.room(r.id)}>
                      <span className="room-title">{r.title}</span>
                      <Stars n={stars(save.rooms[r.id])} />
                    </a>
                  : <div className="room-row locked" data-testid="room-row" data-locked="true" aria-disabled="true">
                      <span className="room-title">{r.title}</span>
                      <span aria-hidden>🔒</span>
                    </div>}
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
