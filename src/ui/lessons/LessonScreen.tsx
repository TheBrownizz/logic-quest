import { useCallback, useEffect, useReducer, useRef, useState, type MouseEvent } from 'react'
import { findLesson, lessonsForStage } from '../../content/lessons/catalog'
import type { Lesson, Step } from '../../content/lessons/types'
import type { Stage, World } from '../../content/types'
import { lessonDone, quizCooldownLeft, recordQuizFail, recordQuizPass, recordStep, stageRoomsOpen } from '../../game/lessonRules'
import { isStageUnlocked } from '../../game/rules'
import { LockNote } from '../LockNote'
import { hasQueryFlag, hrefs, parseHash, queryParam } from '../router'
import { useSave } from '../save'
import { NotFound } from '../StageScreen'
import { worlds } from '../worlds'
import { minutesLeft } from './LessonCard'
import { initPlayer, playerReducer, resumeIndex } from './player'
import { SkipQuiz } from './SkipQuiz'
import { CheckNumberStep } from './steps/CheckNumberStep'
import { CheckStep } from './steps/CheckStep'
import { ExplainStep } from './steps/ExplainStep'
import { RecapStep } from './steps/RecapStep'
import { TryStep } from './steps/TryStep'
import type { StepProps } from './steps/types'
import { WidgetStep } from './steps/WidgetStep'
import { useReducedMotion } from './useReducedMotion'
import './lessons.css'

function findStage(stageId: string): { world: World; stage: Stage } | undefined {
  for (const e of worlds) {
    const stage = e.world?.stages.find(s => s.id === stageId)
    if (stage && e.world) return { world: e.world, stage }
  }
  return undefined
}

export function LessonScreen({ lessonId, stepId }: { lessonId: string; stepId?: string }) {
  const [save] = useSave()
  const lesson = findLesson(lessonId)
  const found = lesson && findStage(lesson.stage)
  if (!lesson || !found || lesson.steps.length === 0) return <NotFound />
  const { world, stage } = found
  if (!isStageUnlocked(world, stage.id, save)) {
    return (
      <section className="lesson">
        <a className="back" href={hrefs.stage(world.id, stage.id)}>→ {stage.title}</a>
        <h1 className="title">{lesson.title}</h1>
        <LockNote world={world} stageId={stage.id} save={save} />
      </section>
    )
  }
  return <Player lesson={lesson} world={world} stage={stage} stepId={stepId} />
}

function StepView(p: StepProps<Step['kind']>) {
  switch (p.step.kind) {
    case 'explain': return <ExplainStep {...(p as StepProps<'explain'>)} />
    case 'widget': return <WidgetStep {...(p as StepProps<'widget'>)} />
    case 'check': return <CheckStep {...(p as StepProps<'check'>)} />
    case 'check-number': return <CheckNumberStep {...(p as StepProps<'check-number'>)} />
    case 'try': return <TryStep {...(p as StepProps<'try'>)} />
    case 'recap': return <RecapStep {...(p as StepProps<'recap'>)} />
  }
}

function Player({ lesson, world, stage, stepId }: { lesson: Lesson; world: World; stage: Stage; stepId?: string }) {
  const [save, update] = useSave()
  const reducedMotion = useReducedMotion()
  // read once: the URL loses its query when the step is written into it
  const [autofill] = useState(() => hasQueryFlag(window.location.search, window.location.hash, 'autofill'))
  const [mode, setMode] = useState<'steps' | 'quiz'>(() =>
    queryParam(window.location.search, window.location.hash, 'quiz') === '1' && !lessonDone(save, lesson.id) &&
    quizCooldownLeft(save, lesson.id, Date.now()) === 0 ? 'quiz' : 'steps')
  const [quizRun, setQuizRun] = useState(0)
  /** Whether the rooms were open when the lesson opened: finishing it may be what opens them. */
  const openBefore = useRef(stageRoomsOpen(world, stage.id, save))
  const [s, dispatch] = useReducer(playerReducer, undefined, () => {
    const saved = save.lessons[lesson.id]
    return initPlayer(lesson, resumeIndex(lesson, saved, stepId), !!saved?.done)
  })
  const i = s.index
  const step = lesson.steps[i]
  const last = i === lesson.steps.length - 1

  // Persist the step on every change and keep it in the URL (no hashchange, so no remount). Not while the skip
  // quiz is open: taking the quiz does not start the lesson.
  useEffect(() => {
    if (mode === 'quiz') return
    update(d => recordStep(world, d, lesson, step.id))
    const h = hrefs.lesson(lesson.id, step.id)
    if (window.location.hash !== h) window.history.replaceState(null, '', h)
  }, [step.id, mode])

  // The player writes its own step into the URL with replaceState, which fires no hashchange. So a hashchange to a
  // step of this same lesson is a manual edit (or a link): jump there, if the player may reach it. The lesson
  // route is not keyed by step, so normal "המשך" navigation never remounts and keeps its in-memory state.
  useEffect(() => {
    const on = () => {
      const r = parseHash(window.location.hash)
      if (r.name !== 'lesson' || r.lessonId !== lesson.id || r.stepId === undefined) return
      const j = lesson.steps.findIndex(st => st.id === r.stepId)
      if (j < 0) return
      dispatch({ type: 'goto', index: j })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [lesson])

  const complete = useCallback(() => dispatch({ type: 'complete', index: i }), [i])
  // React re-renders between the two clicks of a double click, so the second click would come from the new step
  // and move again: a click that is part of a multi-click (detail > 1) is dropped. Keyboard activation has
  // detail 0. The reducer also ignores an action issued from a step the player has already left.
  const move = (e: MouseEvent, a: { type: 'next' | 'back'; from: number }) => {
    if (e.detail > 1) return
    dispatch(a)
  }
  const openNow = stageRoomsOpen(world, stage.id, save)
  const justUnlocked = openNow && !openBefore.current
  const stageHref = hrefs.stage(world.id, stage.id) + (justUnlocked ? '?unlocked=1' : '')
  const wait = quizCooldownLeft(save, lesson.id, Date.now())
  // the next unfinished lesson of the stage: after this one if any, else an earlier one
  const pending = lessonsForStage(stage.id).filter(l => l.id !== lesson.id && !lessonDone(save, l.id))
  const next = pending.find(l => l.order > lesson.order) ?? pending[0]

  const wayOn = (
    <div className="finish-actions">
      {justUnlocked && (
        <div className="unlock-moment" data-testid="unlock-moment" role="status">
          <span className="unlock-icon" aria-hidden>🔓</span> כל השיעורים בשלב הושלמו: חדרי המעבדה והריצה נפתחו!
        </div>
      )}
      {next ? (
        // more lessons wait in this stage: the next one is the way on
        <>
          <div className="row">
            <a className="btn primary" data-testid="to-next-lesson" href={hrefs.lesson(next.id)}>לשיעור הבא ←</a>
            <a className="btn ghost" data-testid="to-rooms" href={stageHref}>לחדרי המעבדה</a>
          </div>
          <p className="muted next-title" data-testid="next-title">השיעור הבא: {next.title}</p>
        </>
      ) : (
        <div className="row">
          <a className={`btn primary${justUnlocked ? ' glow' : ''}`} data-testid="to-rooms" href={stageHref}>לחדרי המעבדה ←</a>
        </div>
      )}
    </div>
  )

  return (
    <section className={`lesson${reducedMotion ? ' reduced' : ''}`} data-testid="lesson" data-lesson={lesson.id}>
      <a className="back" href={hrefs.stage(world.id, stage.id)}>→ {stage.title}</a>
      <header className="lesson-head">
        <p className="lesson-kicker muted">שיעור {lesson.order} · {lesson.minutes} דק׳</p>
        <h1 className="title lesson-h1">{lesson.title}</h1>
        {mode === 'steps' && (
          <ol className="dots" aria-label={`צעד ${i + 1} מתוך ${lesson.steps.length}`} data-testid="lesson-dots">
            {lesson.steps.map((st, j) => {
              const reach = s.completed.slice(0, j).every(Boolean)
              const cls = j === i ? 'cur' : s.completed[j] && reach ? 'done' : ''
              return (
                <li key={st.id}>
                  <button type="button" className={`dot ${cls}`} aria-label={`צעד ${j + 1}`} aria-current={j === i ? 'step' : undefined}
                    disabled={!reach || j === i} onClick={() => dispatch({ type: 'goto', index: j })} />
                </li>
              )
            })}
          </ol>
        )}
      </header>

      {mode === 'quiz' ? (
        <SkipQuiz key={quizRun} lesson={lesson}
          onPass={() => update(d => recordQuizPass(world, d, lesson))}
          onFail={() => update(d => recordQuizFail(d, lesson, Date.now()))}
          onClose={() => { setMode('steps'); setQuizRun(r => r + 1) }}
          passed={wayOn} />
      ) : (
        <>
          <div className={`lesson-step kind-${step.kind}`} key={step.id} data-testid="lesson-step" data-step={step.id} data-kind={step.kind}>
            <StepView step={step} completed={s.completed[i]} onComplete={complete} reducedMotion={reducedMotion} autofill={autofill} world={world} />
            {last && wayOn}
          </div>
          <nav className="lesson-nav" aria-label="ניווט בשיעור">
            <button type="button" className="btn ghost" data-testid="lesson-back" disabled={i === 0}
              onClick={e => move(e, { type: 'back', from: i })}><span aria-hidden>→ </span>חזרה</button>
            {i === 0 && !lessonDone(save, lesson.id) && (
              wait > 0
                ? <span className="muted lesson-quiz-note" data-testid="quiz-cooldown">מבחן דילוג: אפשר לנסות שוב {minutesLeft(wait)}, או אחרי שתסיימו את השיעור</span>
                : <button type="button" className="btn ghost" data-testid="start-quiz" onClick={() => setMode('quiz')}>כבר מכיר? מבחן דילוג</button>
            )}
            {!last && (
              <button type="button" className="btn primary" data-testid="lesson-next" disabled={!s.completed[i]}
                onClick={e => move(e, { type: 'next', from: i })}>המשך<span aria-hidden> ←</span></button>
            )}
          </nav>
        </>
      )}
    </section>
  )
}

