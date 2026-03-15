import { CV } from '@/types/cv'
import { parseTimelineEntries } from './timeline-parser'

export function cvToJsonLd(cv: CV): object {
  const { meta, sections } = cv

  const resolvedLinks =
    meta.links && meta.links.length > 0
      ? meta.links
      : [
          ...(meta.github ? [{ label: 'github', url: `https://github.com/${meta.github}` }] : []),
          ...(meta.linkedin ? [{ label: 'linkedin', url: `https://linkedin.com/in/${meta.linkedin}` }] : []),
          ...(meta.website ? [{ label: 'website', url: meta.website }] : []),
        ]

  const sameAs = resolvedLinks.map((l) => (l.url.startsWith('http') ? l.url : `https://${l.url}`))

  const experienceSections = sections.filter((s) => s.type === 'experience')
  const educationSections = sections.filter((s) => s.type === 'education')
  const skillsSections = sections.filter((s) => s.type === 'skills')

  const hasOccupation = experienceSections.flatMap((s) =>
    parseTimelineEntries(s.content).map((entry) => ({
      '@type': 'Role',
      roleName: entry.role,
      ...(entry.company ? { 'schema:worksFor': { '@type': 'Organization', name: entry.company } } : {}),
      ...(entry.period ? { startDate: entry.period } : {}),
    }))
  )

  const alumniOf = educationSections.flatMap((s) =>
    parseTimelineEntries(s.content).map((entry) => ({
      '@type': 'EducationalOrganization',
      name: entry.company || entry.role,
    }))
  )

  const knowsAbout = skillsSections.flatMap((s) =>
    s.content
      .split(/[\n,|•]+/)
      .map((t) => t.replace(/^[^:]+:/, '').trim())
      .filter((t) => t.length > 0 && t.length <= 50)
  ).slice(0, 40)

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: meta.name,
    ...(meta.title ? { jobTitle: meta.title } : {}),
    ...(meta.email ? { email: meta.email } : {}),
    ...(meta.phone ? { telephone: meta.phone } : {}),
    ...(meta.location ? { address: { '@type': 'PostalAddress', addressLocality: meta.location } } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(hasOccupation.length > 0 ? { hasOccupation } : {}),
    ...(alumniOf.length > 0 ? { alumniOf } : {}),
    ...(knowsAbout.length > 0 ? { knowsAbout } : {}),
  }
}
