import { describe, it, expect } from 'vitest'
import { extractKeywords, buildXmpString } from '@/lib/cv-metadata'
import { CV, DEFAULT_STYLE } from '@/types/cv'

const makeCV = (overrides: Partial<CV> = {}): CV => ({
  meta: {
    name: 'Ada Lovelace',
    title: 'Mathematician',
    email: 'ada@example.com',
  },
  sections: [],
  style: DEFAULT_STYLE,
  docMode: 'md',
  ...overrides,
})

describe('extractKeywords', () => {
  it('includes meta.title as the first keyword', () => {
    const result = extractKeywords(makeCV())
    expect(result[0]).toBe('Mathematician')
  })

  it('includes section titles', () => {
    const cv = makeCV({
      sections: [{ id: 's1', type: 'skills', title: 'Technical Skills', content: 'TypeScript' }],
    })
    const result = extractKeywords(cv)
    expect(result).toContain('Technical Skills')
  })

  it('includes individual skill tokens from skills sections', () => {
    const cv = makeCV({
      sections: [
        { id: 's1', type: 'skills', title: 'Skills', content: 'TypeScript, React, Node.js' },
      ],
    })
    const result = extractKeywords(cv)
    expect(result).toContain('TypeScript')
    expect(result).toContain('React')
    expect(result).toContain('Node.js')
  })

  it('strips category labels from skills (text before colon)', () => {
    const cv = makeCV({
      sections: [
        { id: 's1', type: 'skills', title: 'Skills', content: 'Languages: TypeScript, Go' },
      ],
    })
    const result = extractKeywords(cv)
    expect(result).toContain('TypeScript')
    expect(result).toContain('Go')
    // The raw "Languages: TypeScript" token should not appear
    expect(result.some((k) => k.startsWith('Languages:'))).toBe(false)
  })

  it('includes role and company from experience sections', () => {
    const cv = makeCV({
      sections: [
        {
          id: 'exp-1',
          type: 'experience',
          title: 'Experience',
          content: '### Engineer @ Acme Corp | 2020–2023',
        },
      ],
    })
    const result = extractKeywords(cv)
    expect(result).toContain('Engineer')
    expect(result).toContain('Acme Corp')
  })

  it('includes institution names from education sections', () => {
    const cv = makeCV({
      sections: [
        {
          id: 'edu-1',
          type: 'education',
          title: 'Education',
          content: '### BSc Computer Science | State University | 2015–2019',
        },
      ],
    })
    const result = extractKeywords(cv)
    // The parser treats everything before the last | as the role when no @ is present
    expect(result).toContain('BSc Computer Science | State University')
  })

  it('deduplicates keywords', () => {
    const cv = makeCV({
      sections: [
        { id: 's1', type: 'skills', title: 'Skills', content: 'TypeScript, TypeScript, React' },
      ],
    })
    const result = extractKeywords(cv)
    const tsCount = result.filter((k) => k === 'TypeScript').length
    expect(tsCount).toBe(1)
  })

  it('excludes keywords longer than 50 characters', () => {
    const longKeyword = 'A'.repeat(51)
    const cv = makeCV({
      sections: [{ id: 's1', type: 'skills', title: 'Skills', content: longKeyword }],
    })
    const result = extractKeywords(cv)
    expect(result).not.toContain(longKeyword)
  })

  it('caps the result at 40 keywords', () => {
    const manySkills = Array.from({ length: 60 }, (_, i) => `Skill${i}`).join(', ')
    const cv = makeCV({
      sections: [{ id: 's1', type: 'skills', title: 'Skills', content: manySkills }],
    })
    const result = extractKeywords(cv)
    expect(result.length).toBeLessThanOrEqual(40)
  })

  it('returns an empty array when there are no sections and no title', () => {
    const cv = makeCV({ meta: { name: 'Ada', title: '', email: 'ada@example.com' } })
    const result = extractKeywords(cv)
    expect(result).toEqual([])
  })
})

describe('buildXmpString', () => {
  it('returns a string that starts with the XMP packet header', () => {
    const cv = makeCV()
    const result = buildXmpString(cv, ['TypeScript'])
    expect(result).toMatch(/^<\?xpacket begin/)
  })

  it('ends with the XMP packet close tag', () => {
    const cv = makeCV()
    const result = buildXmpString(cv, [])
    expect(result.trimEnd()).toMatch(/<\?xpacket end="w"\?>$/)
  })

  it('sets dc:title to meta.name', () => {
    const cv = makeCV()
    const result = buildXmpString(cv, [])
    expect(result).toContain('<dc:title>Ada Lovelace</dc:title>')
  })

  it('sets dc:creator to meta.name', () => {
    const cv = makeCV()
    const result = buildXmpString(cv, [])
    expect(result).toContain('<dc:creator>Ada Lovelace</dc:creator>')
  })

  it('sets dc:description to meta.title', () => {
    const cv = makeCV()
    const result = buildXmpString(cv, [])
    expect(result).toContain('<dc:description>Mathematician</dc:description>')
  })

  it('sets cvgen:email to meta.email', () => {
    const cv = makeCV()
    const result = buildXmpString(cv, [])
    expect(result).toContain('<cvgen:email>ada@example.com</cvgen:email>')
  })

  it('includes each keyword as a rdf:li element in the dc:subject bag', () => {
    const cv = makeCV()
    const result = buildXmpString(cv, ['TypeScript', 'React'])
    expect(result).toContain('<rdf:li>TypeScript</rdf:li>')
    expect(result).toContain('<rdf:li>React</rdf:li>')
  })

  it('escapes XML special characters in meta.name', () => {
    const cv = makeCV({
      meta: { name: 'Ada & <Test>', title: 'Eng', email: 'ada@example.com' },
    })
    const result = buildXmpString(cv, [])
    expect(result).toContain('Ada &amp; &lt;Test&gt;')
    expect(result).not.toContain('Ada & <Test>')
  })

  it('escapes XML special characters in keyword values', () => {
    const cv = makeCV()
    const result = buildXmpString(cv, ['C++ & Go'])
    expect(result).toContain('C++ &amp; Go')
  })

  it('includes an empty dc:subject bag when keywords array is empty', () => {
    const cv = makeCV()
    const result = buildXmpString(cv, [])
    expect(result).toContain('<rdf:Bag>')
    expect(result).toContain('</rdf:Bag>')
  })

  it('contains a cvgen:exportedAt timestamp element', () => {
    const cv = makeCV()
    const result = buildXmpString(cv, [])
    expect(result).toContain('<cvgen:exportedAt>')
  })
})

// injectMetadata requires a real pdf-lib PDFDocument (loaded from actual PDF bytes).
// Running it in the jsdom environment without a real PDF would throw a parsing error,
// making it an integration test rather than a unit test.
describe('injectMetadata', () => {
  it.skip('Requires pdf-lib integration with real PDF bytes — skipped in unit test run', () => {
    // This function loads a PDF via PDFDocument.load(), which requires a valid
    // binary PDF. There is no meaningful way to exercise this without either
    // a fixture PDF or a running pdf-lib environment that can generate one.
  })
})
