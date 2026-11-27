import type { ElementType, ReactNode } from 'react'

const HEBREW = /[֐-׿]/

/**
 * Direction of a content string: Hebrew prose renders right-to-left (its formulas sit in ltr() isolates),
 * and a string with no Hebrew (a bare formula or bit string) renders left-to-right.
 */
export const textDir = (s: string): 'rtl' | 'ltr' => (HEBREW.test(s) ? 'rtl' : 'ltr')

/** A content string rendered with an explicit direction (never dir="auto", which a leading Latin token flips). */
export function Prose({ text, as: Tag = 'span', className, children, ...rest }: {
  text: string; as?: ElementType; className?: string; children?: ReactNode; [attr: string]: unknown
}) {
  return <Tag className={className} dir={textDir(text)} {...rest}>{children}{text}</Tag>
}

/** A multi-line definition: each line is its own block with its own direction, so formula lines stay LTR. */
export function ProseLines({ text, className, ...rest }: { text: string; className?: string; 'data-testid'?: string }) {
  return (
    <div className={className} dir="rtl" {...rest}>
      {text.split('\n').map((line, i) => (
        <Prose key={i} as="div" text={line} className={textDir(line) === 'ltr' ? 'line mono line-ltr' : 'line'} />
      ))}
    </div>
  )
}
