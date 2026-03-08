import { NextRequest, NextResponse } from 'next/server'
import ReactPDF, { Document, Page, Text, View, Link, StyleSheet, Font } from '@react-pdf/renderer'
import { createElement as h } from 'react'
import { CV, CVStyle } from '@/types/cv'
import { parseTimelineEntries } from '@/lib/timeline-parser'
import { clipAscii } from '@/lib/clip-ascii'

// Courier is a built-in PDF font — no download needed, always works
Font.register({ family: 'Courier', src: 'Courier' })

// ── Helpers ────────────────────────────────────────────────────────────────

function makeStyles(style: CVStyle) {
  const fs = style.fontSize
  return StyleSheet.create({
    page: {
      fontFamily: 'Courier',
      fontSize: fs,
      backgroundColor: style.bgColor,
      color: style.fgColor,
      paddingTop: 40,
      paddingBottom: 40,
      paddingLeft: 48,
      paddingRight: 48,
      lineHeight: 1.5,
    },
    // header
    headerRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
    headerLeft: { flex: 1 },
    name: { fontSize: fs * 2, fontWeight: 'bold', color: style.fgColor, marginBottom: 2 },
    jobTitle: { fontSize: fs * 1.3, color: style.mutedColor, marginBottom: 6 },
    contactLink: { color: style.accentColor, textDecoration: 'none', marginBottom: 2, fontSize: fs },
    contactPlain: { color: style.mutedColor, marginBottom: 2, fontSize: fs },
    dividerDouble: { color: style.borderColor, marginTop: 8, marginBottom: 20, letterSpacing: -0.5 },
    // photo
    photo: { fontSize: Math.max(fs - 4, 7), color: style.mutedColor, lineHeight: 1 },
    // section
    sectionTitle: { fontSize: fs * 1.1, fontWeight: 'bold', color: style.fgColor, letterSpacing: 0.3, marginBottom: 2 },
    dividerSingle: { color: style.borderColor, marginBottom: 6, letterSpacing: -0.5 },
    sectionSubtitle: { color: style.mutedColor, fontSize: fs, marginBottom: 4 },
    sectionWrap: { marginBottom: 22 },
    // timeline
    timelineRow: { flexDirection: 'row', gap: 4, marginBottom: 1 },
    timelineConnector: { color: style.mutedColor },
    timelineRole: { color: style.fgColor, fontWeight: 'bold' },
    timelinePeriod: { color: style.accentColor },
    timelineMuted: { color: style.mutedColor },
    // content
    contentText: { color: style.fgColor, lineHeight: 1.5 },
    bold: { fontWeight: 'bold', color: style.fgColor },
    codeBg: { backgroundColor: style.codeBgColor, color: style.accentColor },
    muted: { color: style.mutedColor },
  })
}

// ── Inline markdown: only **bold** and plain text (react-pdf can't nest mixed inline) ──

function PlainLine({ line, s }: { line: string; s: ReturnType<typeof makeStyles> }) {
  if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
    return h(Text, { style: { ...s.contentText, fontWeight: 'bold' } }, line)
  }
  const parts: React.ReactNode[] = []
  const pattern = /\*\*([^*]+)\*\*/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > last) parts.push(h(Text, { key: `t${last}` }, line.slice(last, match.index)))
    parts.push(h(Text, { key: `b${match.index}`, style: s.bold }, match[1]))
    last = match.index + match[0].length
  }
  if (last < line.length) parts.push(h(Text, { key: 'tend' }, line.slice(last)))
  if (parts.length === 0) parts.push(h(Text, { key: 'empty' }, line || ' '))
  return h(Text, { style: s.contentText }, ...parts)
}

function PlainContent({ content, s }: { content: string; s: ReturnType<typeof makeStyles> }) {
  return h(
    View,
    null,
    ...content.split('\n').map((line, i) =>
      h(PlainLine, { key: i, line, s })
    )
  )
}

// ── Timeline ───────────────────────────────────────────────────────────────

function TimelineVertical({ content, s }: { content: string; s: ReturnType<typeof makeStyles> }) {
  const entries = parseTimelineEntries(content)
  return h(
    View,
    null,
    ...entries.map((entry, i) => {
      const isLast = i === entries.length - 1
      const prefix = isLast ? '└─' : '├─'
      const cont = isLast ? '  ' : '│'
      return h(
        View,
        { key: i, style: { marginBottom: isLast ? 0 : 2 } },
        h(
          View,
          { style: s.timelineRow },
          h(Text, { style: s.timelineConnector }, prefix),
          entry.period ? h(Text, { style: s.timelinePeriod }, ` ${entry.period} `) : null,
          h(Text, { style: s.timelineRole }, entry.role),
          entry.company ? h(Text, { style: s.timelineMuted }, `  @ ${entry.company}`) : null,
        ),
        entry.description
          ? h(
              View,
              { style: s.timelineRow },
              h(Text, { style: s.timelineConnector }, cont),
              h(Text, { style: { ...s.timelineMuted, flex: 1 } }, ' ' + entry.description),
            )
          : null,
        !isLast ? h(Text, { style: s.timelineConnector }, cont) : null,
      )
    })
  )
}

function TimelineHorizontal({ content, s }: { content: string; s: ReturnType<typeof makeStyles> }) {
  const entries = parseTimelineEntries(content)
  const connector = entries
    .map((e, i) =>
      `[${e.period || e.role}]${i < entries.length - 1 ? '────────' : ''}`
    )
    .join('')
  return h(
    View,
    null,
    h(Text, { style: { color: s.timelinePeriod.color } }, connector),
    h(
      View,
      { style: { flexDirection: 'row', marginTop: 4 } },
      ...entries.map((e, i) =>
        h(
          View,
          { key: i, style: { minWidth: 120, paddingRight: 8 } },
          h(Text, { style: s.timelineRole }, e.role),
          e.company ? h(Text, { style: s.timelineMuted }, `@ ${e.company}`) : null,
        )
      )
    )
  )
}

// ── Section ────────────────────────────────────────────────────────────────

function SectionBlock({ section, s, fs }: {
  section: CV['sections'][number]
  s: ReturnType<typeof makeStyles>
  fs: number
}) {
  const isTimeline =
    (section.type === 'experience' || section.type === 'education') &&
    section.layout !== 'list'

  let content: React.ReactNode
  if (section.type === 'photo') {
    const ascii = section.photoAscii
      ? clipAscii(section.photoAscii, section.photoHeight ?? 40)
      : null
    content = ascii
      ? h(Text, { style: { ...s.photo, fontSize: Math.max(fs - 3, 8) } }, ascii)
      : h(Text, { style: s.muted }, '<!-- upload a photo to generate ASCII art -->')
  } else if (isTimeline) {
    content = section.layout === 'horizontal'
      ? h(TimelineHorizontal, { content: section.content, s })
      : h(TimelineVertical, { content: section.content, s })
  } else {
    content = h(PlainContent, { content: section.content, s })
  }

  return h(
    View,
    { style: s.sectionWrap },
    h(Text, { style: s.sectionTitle }, `## ${section.title}`),
    section.subtitle ? h(Text, { style: s.sectionSubtitle }, section.subtitle) : null,
    h(Text, { style: s.dividerSingle }, '─'.repeat(56)),
    content,
  )
}

// ── Document ───────────────────────────────────────────────────────────────

function CVDocument({ cv }: { cv: CV }) {
  const { meta, sections, style } = cv
  const s = makeStyles(style)
  const fs = style.fontSize

  const contactItems: { label: string; href: string }[] = [
    meta.email    ? { label: meta.email,                          href: `mailto:${meta.email}` }                         : null,
    meta.github   ? { label: `github.com/${meta.github}`,        href: `https://github.com/${meta.github}` }            : null,
    meta.linkedin ? { label: `linkedin.com/in/${meta.linkedin}`, href: `https://linkedin.com/in/${meta.linkedin}` }     : null,
    meta.website  ? { label: meta.website,                       href: meta.website.startsWith('http') ? meta.website : `https://${meta.website}` } : null,
    meta.location ? { label: meta.location,                      href: '' }                                              : null,
  ].filter(Boolean) as { label: string; href: string }[]

  return h(
    Document,
    null,
    h(
      Page,
      { style: s.page },
      // ── Header ──
      h(
        View,
        { style: s.headerRow },
        // left col
        h(
          View,
          { style: s.headerLeft },
          h(Text, { style: s.name }, `# ${meta.name}`),
          meta.title ? h(Text, { style: s.jobTitle }, meta.title) : null,
          h(
            View,
            { style: { marginTop: 6 } },
            ...contactItems.map(({ label, href }) =>
              href
                ? h(Link, { key: label, src: href, style: s.contactLink }, label)
                : h(Text, { key: label, style: s.contactPlain }, label)
            )
          ),
        ),
        // right col: ASCII photo
        meta.photoAscii
          ? h(Text, { style: { ...s.photo, fontSize: Math.max(fs - 4, 7) } },
              clipAscii(meta.photoAscii, meta.photoHeight ?? 25))
          : null,
      ),
      h(Text, { style: s.dividerDouble }, '═'.repeat(60)),
      // ── Sections ──
      ...sections.map((section) =>
        h(SectionBlock, { key: section.id, section, s, fs })
      ),
    )
  )
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const cv: CV = await req.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer: Buffer = await ReactPDF.renderToBuffer(h(CVDocument, { cv }) as any)
    return new NextResponse(buffer.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${cv.meta.name.replace(/\s+/g, '_')}_CV.pdf"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
