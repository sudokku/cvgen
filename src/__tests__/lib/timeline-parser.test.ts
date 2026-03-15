import { describe, it, expect } from 'vitest'
import { parseTimelineEntries, TimelineEntry } from '@/lib/timeline-parser'

describe('parseTimelineEntries', () => {
  it('returns an empty array for an empty string', () => {
    const result = parseTimelineEntries('')
    expect(result).toEqual([])
  })

  it('returns an empty array for a whitespace-only string', () => {
    const result = parseTimelineEntries('   \n  ')
    expect(result).toEqual([])
  })

  it('parses a single standard entry with Role @ Company | Period', () => {
    const content = '### Senior Engineer @ Acme Corp | 2020–2023\nBuilt things.'
    const result = parseTimelineEntries(content)

    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('Senior Engineer')
    expect(result[0].company).toBe('Acme Corp')
    expect(result[0].period).toBe('2020–2023')
    expect(result[0].description).toBe('Built things.')
  })

  it('parses multiple entries from a single content string', () => {
    const content = [
      '### Engineer @ Beta Ltd | 2019–2022',
      'React and Node.js work.',
      '',
      '### Senior Engineer @ Acme Corp | 2022–present',
      'Led backend infrastructure.',
    ].join('\n')

    const result = parseTimelineEntries(content)

    expect(result).toHaveLength(2)
    expect(result[0].role).toBe('Engineer')
    expect(result[0].company).toBe('Beta Ltd')
    expect(result[0].period).toBe('2019–2022')

    expect(result[1].role).toBe('Senior Engineer')
    expect(result[1].company).toBe('Acme Corp')
    expect(result[1].period).toBe('2022–present')
  })

  it('produces an empty description when no lines follow the header', () => {
    const content = '### Engineer @ Acme Corp | 2020–2023'
    const result = parseTimelineEntries(content)

    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('')
  })

  it('returns empty company when @ is absent from the header', () => {
    const content = '### Just A Title | 2020–2023'
    const result = parseTimelineEntries(content)

    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('Just A Title')
    expect(result[0].company).toBe('')
    expect(result[0].period).toBe('2020–2023')
  })

  it('returns empty period when | is absent from the header', () => {
    const content = '### Engineer @ Acme Corp'
    const result = parseTimelineEntries(content)

    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('Engineer')
    expect(result[0].company).toBe('Acme Corp')
    expect(result[0].period).toBe('')
  })

  it('returns empty company and empty period when both @ and | are absent', () => {
    const content = '### Just A Title'
    const result = parseTimelineEntries(content)

    expect(result).toHaveLength(1)
    expect(result[0].role).toBe('Just A Title')
    expect(result[0].company).toBe('')
    expect(result[0].period).toBe('')
  })

  it('uses the last | as the period delimiter (Role | Institution | Period format)', () => {
    // Education-style: "BSc Computer Science | State University | 2015–2019"
    const content = '### BSc Computer Science | State University | 2015–2019\nGraduated with honours.'
    const result = parseTimelineEntries(content)

    expect(result).toHaveLength(1)
    expect(result[0].period).toBe('2015–2019')
    // rest before last | is "BSc Computer Science | State University"
    // @ is absent so the whole rest becomes role
    expect(result[0].role).toBe('BSc Computer Science | State University')
    expect(result[0].company).toBe('')
  })

  it('preserves multi-line descriptions', () => {
    const content = '### Engineer @ Corp | 2020–2023\nLine one.\nLine two.\nLine three.'
    const result = parseTimelineEntries(content)

    expect(result[0].description).toBe('Line one.\nLine two.\nLine three.')
  })

  it('returns objects with all four required fields on every entry', () => {
    const content = '### A @ B | 2021'
    const result = parseTimelineEntries(content)

    const entry: TimelineEntry = result[0]
    expect(entry).toHaveProperty('role')
    expect(entry).toHaveProperty('company')
    expect(entry).toHaveProperty('period')
    expect(entry).toHaveProperty('description')
  })
})
