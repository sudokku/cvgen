import { describe, it, expect } from 'vitest'
import { clipAscii } from '@/lib/clip-ascii'

describe('clipAscii', () => {
  const threeLineAscii = 'line1\nline2\nline3'

  it('returns the full string when content has fewer rows than maxRows', () => {
    const result = clipAscii(threeLineAscii, 10)
    expect(result).toBe(threeLineAscii)
  })

  it('returns the full string when content has exactly maxRows rows', () => {
    const result = clipAscii(threeLineAscii, 3)
    expect(result).toBe(threeLineAscii)
  })

  it('clips to maxRows when content exceeds maxRows', () => {
    const result = clipAscii(threeLineAscii, 2)
    expect(result).toBe('line1\nline2')
  })

  it('clips to a single row when maxRows is 1', () => {
    const result = clipAscii(threeLineAscii, 1)
    expect(result).toBe('line1')
  })

  it('returns an empty string when maxRows is 0', () => {
    const result = clipAscii(threeLineAscii, 0)
    expect(result).toBe('')
  })

  it('returns an empty string when the input is empty', () => {
    const result = clipAscii('', 5)
    expect(result).toBe('')
  })

  it('preserves all content in each row — does not trim individual lines', () => {
    const ascii = '  ██  \n  ░░  \n  ▒▒  '
    const result = clipAscii(ascii, 2)
    expect(result).toBe('  ██  \n  ░░  ')
  })
})
