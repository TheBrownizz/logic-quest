import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ExamQuestion, World } from '../../content/types'
import { findLesson } from '../../content/lessons/catalog'
import {
  bossLocked, buildExam, emptyAnswers, partAEarned, partANeedsOptimal, READY_SCORE, recordExam, scoreExam, type Exam, type ExamMode, type ExamScore, type PartAnswers,
} from '../../game/exam'
import { PuzzleView } from '../lab/PuzzleView'
import { Schematic } from '../schematic/Schematic'
import { findRoom } from '../lab/labLogic'
import type { PuzzleHost } from '../lab/roomParts'
import { moreRooms } from '../LockNote'
import { Prose } from '../Prose'
import { hrefs } from '../router'
import { useSave } from '../save'
import { NotFound } from '../StageScreen'
import { worlds } from '../worlds'
import { bossWorld, clock, HEB_LETTERS, TOPIC_NAMES } from './examText'
import '../lab/lab.css'
import './exam.css'

type Phase =
  | { kind: 'ready' }
  | { kind: 'running'; exam: Exam; deadline: number }
  | { kind: 'done'; exam: Exam; answers: PartAnswers[]; score: ExamScore; timedOut: boolean }

/**
 * The mock exam. Nothing is stored until the exam ends (submitted or out of time), so leaving or reloading
 * mid-exam discards the attempt: a reload comes back to the start page.
 */
export function ExamScreen({ mode }: { mode: ExamMode }) {
  const [save, update] = useSave()
  const world = bossWorld(worlds)
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' })
  if (!world?.boss) return <NotFound />
  const need = bossLocked(world, save)
  const back = <a className="back" href={hrefs.boss}>→ {world.boss.title}</a>

  if (need > 0 && phase.kind === 'ready') {
    return (
      <section className="exam">
        {back}
        <h1 className="title">{world.boss.title}</h1>
        <div className="lock-note" data-testid="boss-lock"><span aria-hidden>🔒</span><p>המבחן נעול. פתרו {moreRooms(need)} בשלב האחרון.</p></div>
      </section>
    )
  }
  if (phase.kind === 'ready') {
    const minutes = buildExam(world.boss.bank, mode, 0).minutes
    return (
      <section className="exam">
        {back}
        <h1 className="title">{mode === 'full' ? 'מבחן מלא' : 'מבחן מקוצר'}</h1>
        <p className="boss-lead">
          {mode === 'full' ? 'ארבע שאלות, אחת מכל נושא' : 'שתי שאלות: מערכות עקיבה ועוד נושא אחד'}, ו-<span className="mono">{minutes}</span> דקות.
          כשהזמן נגמר המבחן מוגש עם מה שעניתם עד אז. בסעיף א׳ אין רמזים ואין &quot;הצג תשובה&quot;.
        </p>
        <p className="boss-lead" data-testid="exam-change-note">
          אין בדיקה באמצע: כל התשובות נשמרות אוטומטית, ואפשר לשנות אותן עד ההגשה. הציון והפירוט מופיעים רק אחרי ההגשה.
        </p>
        <button type="button" className="btn primary" data-testid="exam-start" onClick={() => {
          const seed = Date.now()
          const exam = buildExam(world.boss!.bank, mode, seed)
          setPhase({ kind: 'running', exam, deadline: seed + exam.minutes * 60_000 })
        }}>התחילו את המבחן</button>
      </section>
    )
  }
  if (phase.kind === 'running') {
    return <ExamRun key={phase.exam.seed} world={world} exam={phase.exam} deadline={phase.deadline} onEnd={(answers, timedOut) => {
      const score = scoreExam(phase.exam, answers)
      update(d => recordExam(d, { at: Date.now(), score: score.score, perTopic: score.perTopic, mode }))
      setPhase({ kind: 'done', exam: phase.exam, answers, score, timedOut })
      window.scrollTo?.(0, 0)
    }} />
  }
  return <Results world={world} exam={phase.exam} answers={phase.answers} score={phase.score} timedOut={phase.timedOut} onAgain={() => setPhase({ kind: 'ready' })} />
}

function ExamRun({ world, exam, deadline, onEnd }: { world: World; exam: Exam; deadline: number; onEnd: (a: PartAnswers[], timedOut: boolean) => void }) {
  const [answers, setAnswers] = useState<PartAnswers[]>(() => exam.questions.map(emptyAnswers))
  const [cur, setCur] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [confirm, setConfirm] = useState(false)
  const answersRef = useRef(answers)
  answersRef.current = answers
  const ended = useRef(false)
  const end = useCallback((timedOut: boolean) => {
    if (ended.current) return
    ended.current = true
    onEnd(answersRef.current, timedOut)
  }, [onEnd])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const left = deadline - now
  useEffect(() => { if (left <= 0) end(true) }, [left, end])

  const set = (i: number, p: Partial<PartAnswers>) => setAnswers(a => a.map((x, j) => (j === i ? { ...x, ...p } : x)))
  /** Parts answered (not graded): א with anything entered, ב with a verdict and a reason, ג with a choice. */
  const done = (a: PartAnswers) => [a.aAnswered, a.verdict !== null && a.reason !== null, a.choice !== null].filter(Boolean).length

  // M7: a link out of the exam asks first (the attempt is not saved)
  const [leaveTo, setLeaveTo] = useState<string | null>(null)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
      e.preventDefault()
      setLeaveTo(a.getAttribute('href'))
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return (
    <section className="exam running">
      <div className="exam-bar" role="toolbar" aria-label="ניווט במבחן">
        <span className={`exam-timer mono${left < 5 * 60_000 ? ' low' : ''}`} data-testid="exam-timer" role="timer" aria-label="זמן שנותר">{clock(left)}</span>
        <div className="exam-tabs" role="tablist">
          {exam.questions.map((q, i) => (
            <button key={q.id} type="button" role="tab" aria-selected={cur === i} className={`exam-tab${cur === i ? ' on' : ''}`}
              data-testid={`exam-tab-${i}`} onClick={() => setCur(i)}>
              שאלה {i + 1}<small className="mono">{done(answers[i])}/3</small>
            </button>
          ))}
        </div>
        {confirm
          ? <span className="row">
              <button type="button" className="btn danger" data-testid="exam-submit-confirm" onClick={() => end(false)}>כן, להגיש</button>
              <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>ביטול</button>
            </span>
          : <button type="button" className="btn" data-testid="exam-submit" onClick={() => setConfirm(true)}>הגשה</button>}
      </div>
      {leaveTo !== null && (
        <div className="overlay" role="presentation">
          <div className="panel" role="alertdialog" aria-modal="true" aria-labelledby="leave-h" data-testid="exam-leave">
            <h2 id="leave-h">לצאת מהמבחן?</h2>
            <p>הניסיון לא יישמר והתשובות יימחקו.</p>
            <div className="row">
              <button type="button" className="btn primary" autoFocus onClick={() => setLeaveTo(null)}>להישאר במבחן</button>
              <button type="button" className="btn danger" data-testid="exam-leave-confirm" onClick={() => { const to = leaveTo; setLeaveTo(null); window.location.hash = to }}>לצאת בלי לשמור</button>
            </div>
          </div>
        </div>
      )}
      {exam.questions.map((q, i) => (
        <div key={q.id} hidden={cur !== i} role="tabpanel" data-testid={`exam-q-${i}`}>
          <QuestionView world={world} q={q} n={i + 1} order={exam.order[i]} ans={answers[i]} set={p => set(i, p)} />
          <div className="row exam-nav">
            {i > 0 && <button type="button" className="btn ghost" onClick={() => setCur(i - 1)}>→ לשאלה הקודמת</button>}
            {i + 1 < exam.questions.length && <button type="button" className="btn" data-testid="exam-next" onClick={() => setCur(i + 1)}>לשאלה הבאה ←</button>}
          </div>
        </div>
      ))}
    </section>
  )
}

function QuestionView({ world, q, n, order, ans, set }: { world: World; q: ExamQuestion; n: number; order: number[]; ans: PartAnswers; set: (p: Partial<PartAnswers>) => void }) {
  const [attempt, setAttempt] = useState(0)
  const host = useMemo<PuzzleHost>(() => ({
    hints: [], helped: false, markHelped: () => {}, stars: false, exam: true,
    solve: () => undefined,
    grade: (ok, more) => set({ a: partAEarned(q, ok, more.optimal), aAnswered: more.answered }),
    onRestart: () => setAttempt(a => a + 1),
  }), [set, q])
  return (
    <article className="exam-q" data-qid={q.id}>
      <h2 className="exam-q-title">שאלה {n} <span className="muted">· {TOPIC_NAMES[q.topic]}</span></h2>
      <section className="exam-part" aria-labelledby={`${q.id}-a`}>
        <h3 id={`${q.id}-a`}>א׳ <small className="muted">(10%)</small></h3>
        <Prose as="p" className="exam-prompt" text={q.prompt} />
        {partANeedsOptimal(q) && <p className="muted exam-optimal-note">בסעיף הזה הניקוד ניתן רק על פתרון מינימלי.</p>}
        <div className={`lab exam-lab try-${q.a.type}`}>
          <PuzzleView key={`${q.id}#${attempt}`} host={host} puzzle={q.a} world={world} />
        </div>
      </section>
      <section className="exam-part" aria-labelledby={`${q.id}-b`}>
        <h3 id={`${q.id}-b`}>ב׳ <small className="muted">(10%)</small></h3>
        <p className="exam-claim">נתונה הטענה: <Prose text={q.b.text} /></p>
        <fieldset className="choice exam-verdict" data-testid="exam-verdict">
          <legend>1. האם הטענה נכונה? <small className="muted">(5%)</small></legend>
          {[true, false].map(v => (
            <label key={String(v)} className={`choice-opt${ans.verdict === v ? ' on' : ''}`} data-testid={`verdict-${v}`}>
              <input type="radio" name={`${q.id}-verdict`} checked={ans.verdict === v} onChange={() => set({ verdict: v })} />
              {v ? 'נכונה' : 'לא נכונה'}
            </label>
          ))}
        </fieldset>
        <fieldset className="choice" data-testid="exam-reason">
          <legend>2. בחרו את הנימוק <small className="muted">(5%)</small></legend>
          {q.b.reasons.map((r, i) => (
            <label key={i} className={`choice-opt${ans.reason === i ? ' on' : ''}`} data-testid={`reason-${i}`}>
              <input type="radio" name={`${q.id}-reason`} checked={ans.reason === i} onChange={() => set({ reason: i })} />
              <Prose text={r} />
            </label>
          ))}
        </fieldset>
      </section>
      <section className="exam-part" aria-labelledby={`${q.id}-c`}>
        <h3 id={`${q.id}-c`}>ג׳ <small className="muted">(5%)</small></h3>
        {q.c.figure && <Schematic netlist={q.c.figure} label="שרטוט לשאלה" />}
        <fieldset className="choice" data-testid="exam-mcq">
          <legend><Prose text={q.c.text} /></legend>
          {order.map((oi, k) => (
            <label key={oi} className={`choice-opt${ans.choice === oi ? ' on' : ''}`} data-testid={`mcq-opt-${oi}`}>
              <input type="radio" name={`${q.id}-mcq`} checked={ans.choice === oi} onChange={() => set({ choice: oi })} />
              <span className="choice-n">{HEB_LETTERS[k]}.</span> <Prose text={q.c.options[oi]} />
            </label>
          ))}
        </fieldset>
      </section>
    </article>
  )
}

function Results({ world, exam, answers, score, timedOut, onAgain }: { world: World; exam: Exam; answers: PartAnswers[]; score: ExamScore; timedOut: boolean; onAgain: () => void }) {
  const ready = score.score >= READY_SCORE
  return (
    <section className="exam results" data-testid="exam-results">
      <a className="back" href={hrefs.boss}>→ {world.boss!.title}</a>
      <h1 className="title">תוצאות {exam.mode === 'short' ? 'המבחן המקוצר' : 'המבחן'}</h1>
      {timedOut && <p className="lock-note" role="status"><span aria-hidden>⏱️</span> הזמן נגמר. המבחן הוגש עם מה שעניתם עד אז.</p>}
      <div className="score-hero">
        <span className="score-num mono" data-testid="exam-score">{score.score}</span><span className="muted">/100</span>
        {ready && <span className="ready-badge" data-testid="ready-badge">מוכן למבחן</span>}
        {exam.mode === 'short' && <span className="muted score-raw">({score.raw} מתוך {score.max}, מנורמל)</span>}
      </div>
      <div className="seq-table-wrap">
        <table className="exam-table" data-testid="exam-breakdown">
          <thead><tr><th scope="col">נושא</th><th scope="col">א׳ (10)</th><th scope="col">ב׳ (10)</th><th scope="col">ג׳ (5)</th><th scope="col">סה״כ (25)</th></tr></thead>
          <tbody>
            {score.questions.map(s => (
              <tr key={s.id}>
                <th scope="row">{TOPIC_NAMES[s.topic]}</th>
                <td className="mono">{s.a}</td><td className="mono">{s.verdict + s.reason}</td><td className="mono">{s.c}</td>
                <td className="mono"><b>{s.total}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="sub">מה לחזק</h2>
      <ul className="exam-review">
        {exam.questions.map((q, i) => {
          const s = score.questions[i]
          if (s.total === 25) return <li key={q.id} className="ok">✓ {TOPIC_NAMES[q.topic]}: כל הסעיפים נכונים</li>
          const a = answers[i]
          const lesson = q.review.lesson ? findLesson(q.review.lesson) : undefined
          const room = q.review.room ? findRoom(q.review.room)?.room : undefined
          return (
            <li key={q.id} data-testid={`review-${i}`}>
              <b>{TOPIC_NAMES[q.topic]}</b>
              <ul>
                {s.a === 0 && <li data-testid={`review-a-${i}`}>{!a.aAnswered ? 'סעיף א׳ לא נענה.' : partANeedsOptimal(q) ? 'סעיף א׳: התשובה לא נכונה או לא מינימלית.' : 'סעיף א׳: התשובה לא נכונה.'}</li>}
                {s.verdict === 0 && <li>ב׳: הטענה {q.b.isTrue ? 'נכונה' : 'לא נכונה'}{a.verdict === null ? ' (לא עניתם)' : ''}.</li>}
                {s.verdict > 0 && s.reason === 0 && <li>ב׳: הנימוק הנכון: <Prose text={q.b.reasons[q.b.correctReason]} /></li>}
                {s.c === 0 && <li>ג׳: התשובה הנכונה: <Prose text={q.c.options[q.c.correct]} /></li>}
              </ul>
              <span className="row">
                {lesson && <a className="btn ghost" href={hrefs.lesson(lesson.id)}>שיעור: {lesson.title}</a>}
                {room && <a className="btn ghost" href={hrefs.room(room.id)}>חדר: {room.title}</a>}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="row">
        <button type="button" className="btn primary" onClick={onAgain}>מבחן נוסף</button>
        <a className="btn ghost" href={hrefs.boss}>חזרה לדף המבחן</a>
      </div>
    </section>
  )
}
