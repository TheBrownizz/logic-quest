export function Stars({ n, max = 3, testId }: { n: number; max?: number; testId?: string }) {
  return (
    <span className="stars mono" aria-label={`${n} מתוך ${max} כוכבים`} data-testid={testId}>
      {'★'.repeat(n)}<span className="off">{'☆'.repeat(max - n)}</span>
    </span>
  )
}
