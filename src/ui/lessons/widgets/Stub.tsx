/** The placeholder a widget shows until its task replaces it. */
export function WidgetStub({ name }: { name: string }) {
  return (
    <div className="widget-stub" data-testid="widget-stub" data-widget={name}>
      <span aria-hidden>🛠️</span> וידג'ט בבנייה <span className="mono muted">{name}</span>
    </div>
  )
}
