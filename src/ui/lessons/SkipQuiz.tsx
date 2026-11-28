import { useRef, useState, type ReactNode } from 'react'
import type { Lesson } from '../../content/lessons/types'
import { QUIZ_COOLDOWN_MS, drawQuiz } from '../../game/lessonRules'
import { Prose } from '../Prose'

type Phase = { kind: 'ask'; at: number; right: boolean } | { kind: 'passed' } | { kind: 'failed' }

/**
 * The skip quiz: QUIZ_SIZE questions drawn from the lesson's pool, stopping at the first wrong answer.
 * `onPass` / `onFail` record the outcome (once); `passed` is what the pass screen shows below its message.
 */
export function SkipQuiz({ lesson, onPass, onFail, onClose, passed }: {
  lesson: Lesson; onPass: () => void; onFail: () => void; onClose: () => void; passed: ReactNode
}) {
  const [questions] = useState(() => drawQuiz(lesson.skipQuiz, Math.random))
  const [phase, setPhase] = useState<Phase>({ kind: 'ask', at: 0, right: false })
  const answered = useRef(-1)

  if (phase.kind === 'passed') {
    return (
      <div className="quiz quiz-end good" data-testid="quiz-passed" role="status">
        <div className="finish-badge" aria-hidden>✓</div>
        <h2 className="finish-title">עברתם את מבחן הדילוג</h2>
        <p>השיעור סומן כ"דולג". אפשר לחזור אליו מתי שרוצים.</p>
        {passed}
      </div>
    )
  }
  if (phase.kind === 'failed') {
    return (
      <div className="quiz quiz-end" data-testid="quiz-failed" role="alert">
        <h2 className="finish-title">הפעם לא</h2>
        <p>אין בעיה: זה בדיוק מה שהשיעור מלמד. עברו עליו, ואחרי שתסיימו תוכלו לנסות שוב (או בעוד {QUIZ_COOLDOWN_MS / 60000} דקות).</p>
        <button type="button" className="btn primary" onClick={onClose}>לשיעור ←</button>
      </div>
    )
  }

  const q = questions[phase.at]
  const last = phase.at === questions.length - 1
  const answer = (i: number) => {
    if (answered.current === phase.at) return // one answer per question (a double click)
    answered.current = phase.at
    if (i !== q.correct) { onFail(); setPhase({ kind: 'failed' }); return }
    if (last) { onPass(); setPhase({ kind: 'passed' }); return }
    setPhase({ ...phase, right: true })
  }
  return (
    <div className="quiz" data-testid="quiz">
      <div className="quiz-head">
        <span className="quiz-title">מבחן דילוג</span>
        <span className="muted mono" data-testid="quiz-progress">{phase.at + 1}/{questions.length}</span>
      </div>
      <p className="muted quiz-rule">{questions.length} שאלות. טעות אחת מחזירה לשיעור.</p>
      <div key={q.id} className="quiz-q" data-testid="quiz-q" data-qid={q.id}>
        <Prose as="p" className="lesson-text lesson-q" text={q.prompt} />
        <div className="check-opts" role="group" aria-label="תשובות">
          {q.options.map((o, i) => (
            <button key={i} type="button" className={`check-opt${phase.right && i === q.correct ? ' right' : ''}`}
              data-testid={`quiz-opt-${i}`} disabled={phase.right} onClick={() => answer(i)}>
              <span className="check-mark" aria-hidden>{phase.right && i === q.correct ? '✓' : ''}</span>
              <Prose text={o} />
            </button>
          ))}
        </div>
      </div>
      <div className="lesson-nav">
        <button type="button" className="btn ghost" onClick={onClose}>ביטול</button>
        {phase.right && (
          <button type="button" className="btn primary" data-testid="quiz-next"
            onClick={() => { setPhase({ kind: 'ask', at: phase.at + 1, right: false }) }}>לשאלה הבאה ←</button>
        )}
      </div>
    </div>
  )
}
