import { hrefs } from './router'

export function Placeholder({ title }: { title: string }) {
  return (
    <section>
      <a className="back" href={hrefs.map}>→ למפה</a>
      <h1 className="title">{title}</h1>
      <p className="muted">בבנייה</p>
    </section>
  )
}
