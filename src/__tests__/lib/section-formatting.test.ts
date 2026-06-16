import { describe, expect, it } from 'vitest'
import {
  canParseStructuredTimelineContent,
  parseEducationContent,
  parseExperienceContent,
  parseKeyValueContent,
  parseProjectContent,
  parseSkillsContent,
  serializeEducationContent,
  serializeExperienceContent,
  serializeKeyValueContent,
  serializeProjectContent,
  serializeSkillsContent,
} from '@/lib/section-formatting'

describe('section formatting', () => {
  it('round-trips default experience content', () => {
    const content = [
      '### Senior Engineer @ Acme Corp | 2022–present',
      'Led backend infrastructure team.',
      'Built distributed caching layer with Go and Redis.',
      '',
      '### Engineer @ Beta Ltd | 2019–2022',
      'Full-stack development with React and Node.js.',
    ].join('\n')

    const entries = parseExperienceContent(content)
    expect(entries).toEqual([
      {
        role: 'Senior Engineer',
        company: 'Acme Corp',
        period: '2022–present',
        details: [
          'Led backend infrastructure team.',
          'Built distributed caching layer with Go and Redis.',
        ],
      },
      {
        role: 'Engineer',
        company: 'Beta Ltd',
        period: '2019–2022',
        details: ['Full-stack development with React and Node.js.'],
      },
    ])
    expect(parseExperienceContent(serializeExperienceContent(entries))).toEqual(entries)
  })

  it('round-trips education entries that use degree, institution, and period pipes', () => {
    const content = '### BSc Computer Science | State University | 2015–2019\nGraduated with honours.'

    const entries = parseEducationContent(content)
    expect(entries).toEqual([
      {
        degree: 'BSc Computer Science',
        institution: 'State University',
        period: '2015–2019',
        details: ['Graduated with honours.'],
      },
    ])
    expect(parseEducationContent(serializeEducationContent(entries))).toEqual(entries)
  })

  it('parses EuroPass-style imported sections without losing detail lines', () => {
    const experience = [
      '### Full Stack Developer @ Example SRL | Mar 2021–present',
      '- Developed internal tools',
      '- Maintained APIs',
    ].join('\n')
    const education = [
      '### Computer Science | Technical University | Oct 2016–Jul 2020',
      'Thesis on distributed systems.',
    ].join('\n')

    expect(parseExperienceContent(experience)[0]).toMatchObject({
      role: 'Full Stack Developer',
      company: 'Example SRL',
      period: 'Mar 2021–present',
      details: ['- Developed internal tools', '- Maintained APIs'],
    })
    expect(parseEducationContent(education)[0]).toMatchObject({
      degree: 'Computer Science',
      institution: 'Technical University',
      period: 'Oct 2016–Jul 2020',
      details: ['Thesis on distributed systems.'],
    })
  })

  it('parses project stack fields on their own line or inline in the description', () => {
    const content = [
      '### CV Generator',
      'Markdown-friendly CV builder. Stack: TypeScript, React, Node.js.',
      'Repo: https://github.com/example/cvgen',
      '',
      '### Importer',
      'Reads EuroPass XML.',
      'Stack: XML, Next.js.',
    ].join('\n')

    const entries = parseProjectContent(content)
    expect(entries).toEqual([
      {
        name: 'CV Generator',
        description: 'Markdown-friendly CV builder.',
        stack: ['TypeScript', 'React', 'Node.js'],
        repo: 'https://github.com/example/cvgen',
      },
      {
        name: 'Importer',
        description: 'Reads EuroPass XML.',
        stack: ['XML', 'Next.js'],
        repo: '',
      },
    ])
    expect(parseProjectContent(serializeProjectContent(entries))).toEqual(entries)
  })

  it('round-trips skills category rows', () => {
    const content = [
      'Languages:   TypeScript · Go · Python · Rust',
      'Frameworks:  Next.js · React · FastAPI',
      'Infra:       Docker · Kubernetes · AWS',
    ].join('\n')

    const groups = parseSkillsContent(content)
    expect(groups).toEqual([
      { category: 'Languages', items: ['TypeScript', 'Go', 'Python', 'Rust'] },
      { category: 'Frameworks', items: ['Next.js', 'React', 'FastAPI'] },
      { category: 'Infra', items: ['Docker', 'Kubernetes', 'AWS'] },
    ])
    expect(parseSkillsContent(serializeSkillsContent(groups))).toEqual(groups)
  })

  it('round-trips personal key/value rows', () => {
    const content = 'Date of birth: 1994-02-01\nNationality: Romanian\nPortfolio: https://example.com'

    const rows = parseKeyValueContent(content)
    expect(rows).toEqual([
      { key: 'Date of birth', value: '1994-02-01' },
      { key: 'Nationality', value: 'Romanian' },
      { key: 'Portfolio', value: 'https://example.com' },
    ])
    expect(parseKeyValueContent(serializeKeyValueContent(rows))).toEqual(rows)
  })

  it('keeps malformed timeline entries parseable when they still use headings', () => {
    const content = '### Freelancer | 2020–2023\nBuilt client projects.'

    const entries = parseExperienceContent(content)
    expect(entries).toEqual([
      {
        role: 'Freelancer',
        company: '',
        period: '2020–2023',
        details: ['Built client projects.'],
      },
    ])
    expect(parseExperienceContent(serializeExperienceContent(entries))).toEqual(entries)
  })

  it('does not offer structured timeline parsing for non-empty source without headings', () => {
    expect(canParseStructuredTimelineContent('')).toBe(true)
    expect(canParseStructuredTimelineContent('### Role @ Company | 2024')).toBe(true)
    expect(canParseStructuredTimelineContent('A freeform paragraph without timeline headings.')).toBe(false)
  })
})
