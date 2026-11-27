import type { Lesson } from '../../content/lessons/types'
import { lessonStatus, quizCooldownLeft, type LessonStatus } from '../../game/lessonRules'
import type { SaveData } from '../../game/progress'
import { Prose } from '../Prose'
import { hrefs } from '../router'
import './lessons.css'

export const STATUS_TEXT: Record<LessonStatus, string> = { new: 'חדש', progress: 'בתהליך', done: 'הושלם', skipped: 'דולג' }

/** Whole minutes left, rounded up ("עוד 3 דקות"). */
export const minutesLeft = (ms: number): string => {
  const m = Math.max(1, Math.ceil(ms / 60000))
  return m === 1 ? 'עוד דקה' : `עוד ${m} דקות`
}

/** A lesson on the stage screen: title, minutes, blurb, status, and the skip-quiz entry. */
export function LessonCard({ lesson, save, recommended }: { lesson: Lesson; save: SaveData; recommended: boolean }) {
  const status = lessonStatus(save, lesson.id)
  const wait = quizCooldownLeft(save, lesson.id, Date.now())
  const finished = status === 'done' || status === 'skipped'
  return (
    <li className={`lesson-card status-${status}`} data-testid={`lesson-card-${lesson.id}`} data-status={status}>
      <a className="lesson-main" href={hrefs.lesson(lesson.id)}>
        <span className="lesson-num mono" aria-hidden>{finished ? '✓' : lesson.order}</span>
        <span className="lesson-body">
          <span className="lesson-title">{lesson.title}</span>
          <Prose as="span" className="lesson-blurb muted" text={lesson.blurb} />
        </span>
        <span className="lesson-meta">
          <span className={`pill pill-${status}`} data-testid="lesson-status">{STATUS_TEXT[status]}</span>
          {recommended && status === 'new' && <span className="pill pill-rec">מומלץ</span>}
          <span className="muted lesson-min">{lesson.minutes} דק׳</span>
        </span>
      </a>
      {!finished && (
        wait > 0
          ? <span className="lesson-quiz muted" data-testid="quiz-cooldown">מבחן דילוג: אפשר לנסות שוב {minutesLeft(wait)}, או אחרי שתסיימו את השיעור</span>
          : <a className="lesson-quiz" href={hrefs.lessonQuiz(lesson.id)} data-testid="card-quiz">כבר מכיר? מבחן דילוג</a>
      )}
    </li>
  )
}
