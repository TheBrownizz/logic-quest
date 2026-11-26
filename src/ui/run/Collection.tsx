import type { Stage } from '../../content/types'
import { useSave } from '../save'
import { worlds } from '../worlds'
import { FlagButton } from './CardView'
import './run.css'

export function Collection() {
  const [save] = useSave()
  const stages: Stage[] = worlds.flatMap(w => [...(w.world?.stages ?? [])].sort((a, b) => a.order - b.order))
  const all = stages.flatMap(s => s.cards)
  const got = all.filter(c => save.knowledge.includes(c.id)).length
  return (
    <section className="collection">
      <h1 className="title">האוסף</h1>
      <p className="run-counter mono" data-testid="collected">נאספו {got}/{all.length}</p>
      {stages.map(s => (
        <div key={s.id} className="coll-stage" style={{ ['--stage' as string]: `var(--g${((s.order - 1) % 6) + 1})` }}>
          <h2 className="sub"><span className="mono accent">{s.order}</span> {s.title}</h2>
          <div className="coll-grid">
            {s.cards.map(c => save.knowledge.includes(c.id) ? (
              <article key={c.id} className="kcard" data-testid="kcard">
                <p className="k-q muted" dir="auto">{c.text}</p>
                <p className="k-text" dir="auto">{c.knowledge}</p>
                <span className="source muted" dir="auto">{c.source}</span>
                <FlagButton id={c.id} />
              </article>
            ) : (
              <div key={c.id} className="kcard locked" data-testid="klocked" aria-label="קלף ידע נעול"><span aria-hidden>?</span></div>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
