import { hrefs } from './router'
import { worlds } from './worlds'

export function MapScreen() {
  return (
    <section>
      <h1 className="title">מפת העולמות</h1>
      <p className="muted">בחר עולם והתחל לפתור חדרים. כל כוכב נשמר.</p>
      <div className="world-grid">
        {worlds.map(w => w.world ? (
          <a key={w.id} className="world-card" href={hrefs.world(w.id)}>
            <span className="world-icon" aria-hidden>{w.icon}</span>
            <span className="world-name">{w.title}</span>
            <span className="world-meta"><span className="mono">{w.world.stages.length}</span> שלבים</span>
          </a>
        ) : (
          <div key={w.id} className="world-card disabled" aria-disabled="true">
            <span className="world-icon" aria-hidden>{w.icon}</span>
            <span className="world-name">{w.title}</span>
            <span className="badge">בקרוב</span>
          </div>
        ))}
      </div>
    </section>
  )
}
