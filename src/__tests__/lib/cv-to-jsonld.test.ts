import { describe, it, expect } from 'vitest'
import { cvToJsonLd } from '@/lib/cv-to-jsonld'
import { CV, DEFAULT_STYLE } from '@/types/cv'

// Minimal valid CV fixture derived from the actual CV type.
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

describe('cvToJsonLd', () => {
  describe('@context and @type', () => {
    it('always returns @context set to https://schema.org', () => {
      const result = cvToJsonLd(makeCV()) as Record<string, unknown>
      expect(result['@context']).toBe('https://schema.org')
    })

    it('always returns @type set to Person', () => {
      const result = cvToJsonLd(makeCV()) as Record<string, unknown>
      expect(result['@type']).toBe('Person')
    })
  })

  describe('basic meta fields', () => {
    it('includes name from meta.name', () => {
      const result = cvToJsonLd(makeCV()) as Record<string, unknown>
      expect(result['name']).toBe('Ada Lovelace')
    })

    it('includes jobTitle from meta.title', () => {
      const result = cvToJsonLd(makeCV()) as Record<string, unknown>
      expect(result['jobTitle']).toBe('Mathematician')
    })

    it('includes email from meta.email', () => {
      const result = cvToJsonLd(makeCV()) as Record<string, unknown>
      expect(result['email']).toBe('ada@example.com')
    })

    it('omits jobTitle when meta.title is empty', () => {
      const cv = makeCV({ meta: { name: 'Ada', title: '', email: 'a@b.com' } })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      expect(result).not.toHaveProperty('jobTitle')
    })

    it('includes telephone when meta.phone is provided', () => {
      const cv = makeCV({ meta: { name: 'Ada', title: 'Eng', email: 'a@b.com', phone: '+1-555-0100' } })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      expect(result['telephone']).toBe('+1-555-0100')
    })

    it('includes address.addressLocality when meta.location is provided', () => {
      const cv = makeCV({ meta: { name: 'Ada', title: 'Eng', email: 'a@b.com', location: 'London, UK' } })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const address = result['address'] as Record<string, unknown>
      expect(address['@type']).toBe('PostalAddress')
      expect(address['addressLocality']).toBe('London, UK')
    })
  })

  describe('sameAs from meta.links', () => {
    it('builds sameAs from meta.links URLs', () => {
      const cv = makeCV({
        meta: {
          name: 'Ada',
          title: 'Eng',
          email: 'a@b.com',
          links: [
            { label: 'GitHub', url: 'https://github.com/ada' },
            { label: 'LinkedIn', url: 'https://linkedin.com/in/ada' },
          ],
        },
      })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      expect(result['sameAs']).toEqual([
        'https://github.com/ada',
        'https://linkedin.com/in/ada',
      ])
    })

    it('prefixes sameAs URLs with https:// when they do not start with http', () => {
      const cv = makeCV({
        meta: {
          name: 'Ada',
          title: 'Eng',
          email: 'a@b.com',
          links: [{ label: 'site', url: 'example.com/ada' }],
        },
      })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const sameAs = result['sameAs'] as string[]
      expect(sameAs[0]).toBe('https://example.com/ada')
    })

    it('falls back to deprecated github field when meta.links is absent', () => {
      const cv = makeCV({
        meta: { name: 'Ada', title: 'Eng', email: 'a@b.com', github: 'ada' },
      })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const sameAs = result['sameAs'] as string[]
      expect(sameAs).toContain('https://github.com/ada')
    })

    it('falls back to deprecated linkedin field when meta.links is absent', () => {
      const cv = makeCV({
        meta: { name: 'Ada', title: 'Eng', email: 'a@b.com', linkedin: 'ada-lovelace' },
      })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const sameAs = result['sameAs'] as string[]
      expect(sameAs).toContain('https://linkedin.com/in/ada-lovelace')
    })

    it('omits sameAs when no links and no deprecated link fields are set', () => {
      const result = cvToJsonLd(makeCV()) as Record<string, unknown>
      expect(result).not.toHaveProperty('sameAs')
    })

    it('prefers meta.links over deprecated fields when both are present', () => {
      const cv = makeCV({
        meta: {
          name: 'Ada',
          title: 'Eng',
          email: 'a@b.com',
          github: 'old-github',
          links: [{ label: 'GitHub', url: 'https://github.com/new-github' }],
        },
      })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const sameAs = result['sameAs'] as string[]
      expect(sameAs).toContain('https://github.com/new-github')
      expect(sameAs).not.toContain('https://github.com/old-github')
    })
  })

  describe('hasOccupation from experience sections', () => {
    it('builds hasOccupation entries from experience sections', () => {
      const cv = makeCV({
        sections: [
          {
            id: 'exp-1',
            type: 'experience',
            title: 'Experience',
            content: '### Engineer @ Acme Corp | 2020–2023\nBuilt things.',
          },
        ],
      })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const occ = result['hasOccupation'] as Record<string, unknown>[]

      expect(occ).toHaveLength(1)
      expect(occ[0]['@type']).toBe('Role')
      expect(occ[0]['roleName']).toBe('Engineer')
    })

    it('includes worksFor with organization name in hasOccupation entry', () => {
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
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const occ = result['hasOccupation'] as Record<string, unknown>[]
      const worksFor = occ[0]['schema:worksFor'] as Record<string, unknown>

      expect(worksFor['@type']).toBe('Organization')
      expect(worksFor['name']).toBe('Acme Corp')
    })

    it('omits worksFor when no company is parsed from the entry', () => {
      const cv = makeCV({
        sections: [
          {
            id: 'exp-1',
            type: 'experience',
            title: 'Experience',
            content: '### Freelancer | 2020–2023',
          },
        ],
      })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const occ = result['hasOccupation'] as Record<string, unknown>[]

      expect(occ[0]).not.toHaveProperty('schema:worksFor')
    })

    it('omits hasOccupation when there are no experience sections', () => {
      const result = cvToJsonLd(makeCV()) as Record<string, unknown>
      expect(result).not.toHaveProperty('hasOccupation')
    })
  })

  describe('alumniOf from education sections', () => {
    it('builds alumniOf entries from education sections', () => {
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
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const alumni = result['alumniOf'] as Record<string, unknown>[]

      expect(alumni).toHaveLength(1)
      expect(alumni[0]['@type']).toBe('EducationalOrganization')
    })

    it('uses role as institution name when no @ is in the education entry', () => {
      const cv = makeCV({
        sections: [
          {
            id: 'edu-1',
            type: 'education',
            title: 'Education',
            content: '### State University | 2015–2019',
          },
        ],
      })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const alumni = result['alumniOf'] as Record<string, unknown>[]

      // No @ means company is '' and role is the institution name
      expect(alumni[0]['name']).toBe('State University')
    })

    it('omits alumniOf when there are no education sections', () => {
      const result = cvToJsonLd(makeCV()) as Record<string, unknown>
      expect(result).not.toHaveProperty('alumniOf')
    })
  })

  describe('knowsAbout from skills sections', () => {
    it('builds knowsAbout from comma-separated skills content', () => {
      const cv = makeCV({
        sections: [
          {
            id: 'skills-1',
            type: 'skills',
            title: 'Skills',
            content: 'TypeScript, React, Node.js',
          },
        ],
      })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const knowsAbout = result['knowsAbout'] as string[]

      expect(knowsAbout).toContain('TypeScript')
      expect(knowsAbout).toContain('React')
      expect(knowsAbout).toContain('Node.js')
    })

    it('strips category labels (text before colon) from skills lines', () => {
      const cv = makeCV({
        sections: [
          {
            id: 'skills-1',
            type: 'skills',
            title: 'Skills',
            content: 'Languages: TypeScript, Go',
          },
        ],
      })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const knowsAbout = result['knowsAbout'] as string[]

      expect(knowsAbout).not.toContain('Languages: TypeScript')
      expect(knowsAbout).toContain('TypeScript')
      expect(knowsAbout).toContain('Go')
    })

    it('excludes skills tokens longer than 50 characters', () => {
      const longSkill = 'A'.repeat(51)
      const cv = makeCV({
        sections: [
          {
            id: 'skills-1',
            type: 'skills',
            title: 'Skills',
            content: `${longSkill}, TypeScript`,
          },
        ],
      })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const knowsAbout = result['knowsAbout'] as string[]

      expect(knowsAbout).not.toContain(longSkill)
      expect(knowsAbout).toContain('TypeScript')
    })

    it('caps knowsAbout at 40 items across all skills sections', () => {
      const manySkills = Array.from({ length: 50 }, (_, i) => `Skill${i}`).join(', ')
      const cv = makeCV({
        sections: [
          {
            id: 'skills-1',
            type: 'skills',
            title: 'Skills',
            content: manySkills,
          },
        ],
      })
      const result = cvToJsonLd(cv) as Record<string, unknown>
      const knowsAbout = result['knowsAbout'] as string[]

      expect(knowsAbout.length).toBeLessThanOrEqual(40)
    })

    it('omits knowsAbout when there are no skills sections', () => {
      const result = cvToJsonLd(makeCV()) as Record<string, unknown>
      expect(result).not.toHaveProperty('knowsAbout')
    })
  })
})
