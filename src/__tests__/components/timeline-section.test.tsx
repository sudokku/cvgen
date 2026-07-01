import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TimelineSection } from '@/components/Preview/TimelineSection'
import { DEFAULT_STYLE } from '@/types/cv'

describe('TimelineSection', () => {
  it('keeps inline bold formatting when a detail wraps across visual lines', () => {
    const longBoldText = [
      'this important achievement is intentionally long enough to cross the fixed',
      'timeline wrap boundary while staying inside one markdown bold span',
    ].join(' ')

    const { container } = render(
      <TimelineSection
        entries={[
          {
            role: 'Engineer',
            company: 'Acme',
            period: '2024',
            description: `**${longBoldText}**`,
          },
        ]}
        layout="vertical"
        style={DEFAULT_STYLE}
      />
    )

    expect(container.textContent).not.toContain('**')

    const boldSpans = Array.from(container.querySelectorAll('span'))
      .filter((span) => span.style.fontWeight === '700')

    expect(boldSpans.length).toBeGreaterThan(1)
    expect(boldSpans[0].textContent).toContain('this important achievement')
    expect(boldSpans.at(-1)?.textContent).toContain('markdown bold span')
  })
})
