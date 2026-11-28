import { bestExam, bossLocked, EXAM_MINUTES, READY_SCORE } from '../../game/exam'
import { moreRooms } from '../LockNote'
import { hrefs } from '../router'
import { useSave } from '../save'
import { NotFound } from '../StageScreen'
import { worlds } from '../worlds'
import { bossWorld } from './examText'
import './exam.css'

/** The boss's page: what the mock exam is, its lock, the best score and the start buttons. */
export function BossScreen() {
  const [save] = useSave()
  const world = bossWorld(worlds)
  const boss = world?.boss
  if (!world || !boss) return <NotFound />
  const need = bossLocked(world, save)
  const last = [...world.stages].sort((a, b) => b.order - a.order)[0]
  const best = bestExam(save)
  const recent = [...save.exams.attempts].reverse().slice(0, 5)
  return (
    <section className="boss">
      <a className="back" href={hrefs.world(world.id)}>→ {world.title}</a>
      <h1 className="title"><span aria-hidden>🎓</span> {boss.title}</h1>
      <p className="boss-lead">
        מבחן בפורמט של המכון: ארבע שאלות, אחת מכל נושא, ובכל שאלה שלושה סעיפים. סעיף א׳ הוא חידה (10 נקודות, הכול או כלום),
        סעיף ב׳ הוא טענה (5 על נכון או לא נכון, ועוד 5 על הנימוק), וסעיף ג׳ הוא שאלה אמריקאית עם שש אפשרויות (5 נקודות).
      </p>
      {need > 0 ? (
        <div className="lock-note" data-testid="boss-lock">
          <span aria-hidden>🔒</span>
          <p>המבחן נעול. פתרו {moreRooms(need)} בשלב האחרון ({last.title}) כדי לפתוח אותו.</p>
        </div>
      ) : (
        <>
          <div className="boss-best" data-testid="boss-best">
            {best === undefined
              ? <span className="muted">עוד לא נבחנתם.</span>
              : <>הציון הכי טוב: <b className="mono">{best}</b><span className="muted">/100</span>
                {best >= READY_SCORE && <span className="ready-badge" data-testid="ready-badge">מוכן למבחן</span>}</>}
          </div>
          <div className="boss-modes">
            <a className="boss-mode" href={hrefs.exam('full')} data-testid="start-full">
              <b>מבחן מלא</b>
              <span className="boss-min"><span className="mono">{EXAM_MINUTES.full}</span> דקות</span>
              <span className="muted">ארבע שאלות, נושאים 1–4</span>
            </a>
            <a className="boss-mode" href={hrefs.exam('short')} data-testid="start-short">
              <b>מבחן מקוצר</b>
              <span className="boss-min"><span className="mono">{EXAM_MINUTES.short}</span> דקות</span>
              <span className="muted">שתי שאלות: מערכות עקיבה ועוד נושא אחד. הציון מנורמל ל-100.</span>
            </a>
          </div>
          <p className="muted boss-note">המבחן נוח יותר במסך רחב (768 פיקסלים ומעלה). יציאה מהמבחן או רענון הדף מבטלים את הניסיון.</p>
          {recent.length > 0 && (
            <>
              <h2 className="sub">ניסיונות אחרונים</h2>
              <ul className="boss-attempts" data-testid="boss-attempts">
                {recent.map(a => (
                  <li key={a.at}>
                    <span>{new Date(a.at).toLocaleDateString('he-IL')}</span>
                    <span className="muted">{a.mode === 'short' ? 'מקוצר' : a.mode === 'full' ? 'מלא' : ''}</span>
                    <b className="mono">{a.score}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  )
}
