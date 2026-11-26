export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <span className="stars mono" aria-label={`${n} מתוך ${max} כוכבים`}>
      {'★'.repeat(n)}<span className="off">{'☆'.repeat(max - n)}</span>
    </span>
  )
}
