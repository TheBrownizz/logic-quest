import { useEffect, useMemo, useRef, useState } from 'react'
import { buildDeck } from '../../game/deck'
import { answer, mulberry32, startRun, MAX_LIVES, type RunState } from '../../game/run'
import { hrefs } from '../router'
import { useSave } from '../save'
import { NotFound } from '../StageScreen'
import { findWorld, worlds } from '../worlds'
import { CardView } from './CardView'
import './run.css'

/** `?seed=N` from the real query string or from the hash query; null if absent or not a number. */
export function parseSeed(search: string, hash: string): number | null {
  const q = hash.includes('?') ? hash.slice(hash.indexOf('?')) : search
  const v = new URLSearchParams(q).get('seed')
  if (v === null || v.trim() === '' || !Number.isFinite(Number(v))) return null
  return Number(v)
}

function useCountUp(target: number): number {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || from.current === target) { from.current = target; setShown(target); return }
    const start = performance.now(), a = from.current, dur = 600
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const v = Math.round(a + (target - a) * (1 - Math.pow(1 - p, 3)))
      from.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return shown
}

function Hud({ run, shown: at }: { run: RunState; shown: number }) {
  const shown = useCountUp(run.score)
  return (
    <div className="run-hud" data-testid="hud">
      <span className="lives" data-testid="lives" aria-label={`${run.lives} חיים`}>
        {Array.from({ length: MAX_LIVES }, (_, i) => <span key={i} className={`heart ${i < run.lives ? 'on' : 'off'}`} aria-hidden>{i < run.lives ? '♥' : '♡'}</span>)}
      </span>
      <span className="mult mono" dir="ltr" data-testid="multiplier" key={run.multiplier}>{`×${run.multiplier}`}</span>
      <span className="score mono" data-testid="score" data-score={run.score}>{shown}</span>
      <span className="progress muted" data-testid="progress">קלף {Math.min(at + 1, run.deck.length)}/{run.deck.length}</span>
    </div>
  )
}

function Run({ stageId, worldId, deckCards, seed, onAgain }: {
  stageId: string; worldId: string; deckCards: ReturnType<typeof buildDeck> & object; seed: number; onAgain: () => void
}) {
  const [save, update] = useSave()
  const [run, setRun] = useState(() => startRun(deckCards, mulberry32(seed)))
  const [shown, setShown] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const answered = useRef(-1)
  const prevBest = useRef(save.bestRun[stageId] ?? 0)
  const recorded = useRef(false)
  // display order of each card's reasons, shuffled per card so the right one is not always first
  const orders = useMemo(() => run.deck.map((c, i) => {
    const n = c.kind === 'claim' ? c.reasons.length : 6
    const o = Array.from({ length: n }, (_, k) => k)
    const r = mulberry32(seed + i + 1)
    for (let k = n - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1));[o[k], o[j]] = [o[j], o[k]] }
    return o
  }), [run.deck, seed])

  useEffect(() => {
    if (!run.done || recorded.current) return
    recorded.current = true
    update(d => ({ ...d, bestRun: { ...d.bestRun, [stageId]: Math.max(d.bestRun[stageId] ?? 0, run.score) } }))
  }, [run.done, run.score, stageId, update])

  // answer() applies at reveal so the HUD reacts at once; "next" only moves on. One answer per card.
  const reveal = (ok: boolean) => {
    if (answered.current === shown) return
    answered.current = shown
    const id = run.deck[shown].id
    if (!ok) update(d => d.knowledge.includes(id) ? d : { ...d, knowledge: [...d.knowledge, id] })
    setRun(r => answer(r, ok))
    setRevealed(true)
  }
  const next = () => { setRevealed(false); setShown(i => i + 1) }

  const stageHref = hrefs.stage(worldId, stageId)
  if (run.done && !revealed) {
    const isNew = run.score > prevBest.current
    const cardById = new Map(deckCards.map(c => [c.id, c]))
    return (
      <section className="run end" data-testid="end">
        <h1 className="title">סוף ריצה</h1>
        <div className="end-score mono" data-testid="final-score">{run.score}</div>
        {isNew && <p className="newbest" data-testid="new-best">שיא חדש!</p>}
        <p className="muted">שיא קודם: <span className="mono">{prevBest.current}</span></p>
        {run.mistakes.length > 0 ? (
          <>
            <h2 className="sub">קלפי ידע חדשים</h2>
            <ul className="mistakes">
              {run.mistakes.map(id => <li key={id}><a href={hrefs.collection} dir="auto">{cardById.get(id)?.text ?? id}</a></li>)}
            </ul>
          </>
        ) : <p className="ok">ריצה נקייה, בלי טעויות.</p>}
        <div className="row end-actions">
          <button type="button" className="btn primary" onClick={onAgain}>עוד ריצה</button>
          <a className="btn" href={stageHref}>חזרה לשלב</a>
        </div>
      </section>
    )
  }

  const card = run.deck[shown]
  return (
    <section className="run">
      <a className="back" href={stageHref}>→ לשלב</a>
      <Hud run={run} shown={shown} />
      <CardView key={card.id} card={card} order={orders[shown]}
        onReveal={reveal}
        onNext={next} />
    </section>
  )
}

export function RunScreen({ stageId }: { stageId: string }) {
  const [save] = useSave()
  const [again, setAgain] = useState<number | null>(null)
  const world = worlds.find(w => w.world?.stages.some(s => s.id === stageId))?.world
  const [initial] = useState(() => parseSeed(window.location.search, window.location.hash) ?? Date.now())
  if (!world || !findWorld(world.id)) return <NotFound />
  const deck = buildDeck(world, stageId, save)
  if (!deck) {
    return (
      <section>
        <a className="back" href={hrefs.world(world.id)}>→ {world.title}</a>
        <div className="lock-note"><span aria-hidden>🔒</span><p>השלב נעול. פתור 60% מהשלב הקודם כדי להיכנס.</p></div>
      </section>
    )
  }
  if (deck.length === 0) return <NotFound />
  const seed = again ?? initial
  return <Run key={seed} stageId={stageId} worldId={world.id} deckCards={deck} seed={seed} onAgain={() => setAgain(Date.now())} />
}
