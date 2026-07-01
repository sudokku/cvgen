import { CV } from '@/types/cv'
import { normalizeCV } from './section-formatting'

export function cvToJsonLd(cv: CV): object {
  const { meta, sections } = normalizeCV(cv)

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
  const certificationSections = sections.filter((s) => s.type === 'certifications')
  const languageSections = sections.filter((s) => s.type === 'languages')

  const hasOccupation = experienceSections.flatMap((s) =>
    s.entries.map((entry) => ({
      '@type': 'Role',
      roleName: entry.role,
      ...(entry.company ? { 'schema:worksFor': { '@type': 'Organization', name: entry.company } } : {}),
      ...(entry.period ? { startDate: entry.period } : {}),
    }))
  )

  const alumniOf = educationSections.flatMap((s) =>
    s.entries.map((entry) => ({
      '@type': 'EducationalOrganization',
      name: entry.institution || entry.degree,
    }))
  )

  const knowsAbout = skillsSections.flatMap((s) =>
    s.groups
      .flatMap((group) => group.items)
      .filter((item) => item.length > 0 && item.length <= 50)
  ).slice(0, 40)

  const hasCredential = certificationSections.flatMap((s) =>
    s.entries
      .filter((entry) => entry.name.trim() || entry.issuer.trim())
      .map((entry) => ({
        '@type': 'EducationalOccupationalCredential',
        ...(entry.name ? { name: entry.name } : {}),
        ...(entry.issuer ? { recognizedBy: { '@type': 'Organization', name: entry.issuer } } : {}),
        ...(entry.date ? { dateCreated: entry.date } : {}),
        ...(entry.credentialId ? { identifier: entry.credentialId } : {}),
        ...(entry.link ? { url: entry.link } : {}),
        ...(entry.details.length > 0 ? { description: entry.details.filter(Boolean).join(' ') } : {}),
      }))
  )

  const knowsLanguage = languageSections.flatMap((s) =>
    s.entries
      .filter((entry) => entry.language.trim())
      .map((entry) => ({
        '@type': 'Language',
        name: entry.language,
        ...(entry.proficiency ? { description: entry.proficiency } : {}),
      }))
  )

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
    ...(hasCredential.length > 0 ? { hasCredential } : {}),
    ...(knowsLanguage.length > 0 ? { knowsLanguage } : {}),
  }
}
