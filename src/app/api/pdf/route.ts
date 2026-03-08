import { NextRequest, NextResponse } from 'next/server'
import { CV, CVStyle } from '@/types/cv'

// Chromium binary URL must match the installed @sparticuz/chromium-min major version (143)
const CHROMIUM_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.tar'

async function getBrowser() {
  if (process.env.VERCEL) {
    const chromium = (await import('@sparticuz/chromium-min')).default
    const puppeteerCore = (await import('puppeteer-core')).default
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(CHROMIUM_URL),
      headless: true,
    })
  }
  // Local dev — use full puppeteer with bundled Chromium
  const puppeteer = (await import('puppeteer')).default
  return puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
}
import { parseTimelineEntries } from '@/lib/timeline-parser'
import { clipAscii } from '@/lib/use-ascii'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderTimelineVertical(content: string, style: CVStyle): string {
  const entries = parseTimelineEntries(content)
  return entries
    .map((entry, i) => {
      const isLast = i === entries.length - 1
      const prefix = isLast ? '└─' : '├─'
      const continuation = isLast ? '&nbsp;&nbsp;' : '│&nbsp;'
      return `
      <div style="margin-bottom:${isLast ? 0 : 2}px;font-family:inherit">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:baseline">
          <span style="color:${style.mutedColor}">${prefix}</span>
          ${entry.period ? `<span style="color:${style.accentColor}">${escapeHtml(entry.period)}</span>` : ''}
          <span style="color:${style.fgColor};font-weight:600">${escapeHtml(entry.role)}</span>
          ${entry.company ? `<span style="color:${style.mutedColor}">@ ${escapeHtml(entry.company)}</span>` : ''}
        </div>
        ${entry.description ? `
        <div style="display:flex;gap:6px">
          <span style="color:${style.mutedColor}">${continuation}</span>
          <span style="color:${style.mutedColor};white-space:pre-wrap">${escapeHtml(entry.description)}</span>
        </div>` : ''}
        ${!isLast ? `<div style="color:${style.mutedColor}">│</div>` : ''}
      </div>`
    })
    .join('')
}

function renderTimelineHorizontal(content: string, style: CVStyle): string {
  const entries = parseTimelineEntries(content)
  const connectors = entries
    .map((e, i) =>
      `<span style="color:${style.accentColor}">[${escapeHtml(e.period || e.role)}]</span>${i < entries.length - 1 ? `<span style="color:${style.mutedColor}">────────</span>` : ''}`
    )
    .join('')

  const details = entries
    .map(
      (e) => `
    <div style="min-width:160px;padding-right:12px;vertical-align:top;display:inline-block">
      <div style="color:${style.fgColor};font-weight:600">${escapeHtml(e.role)}</div>
      ${e.company ? `<div style="color:${style.mutedColor}">@ ${escapeHtml(e.company)}</div>` : ''}
    </div>`
    )
    .join('')

  return `
  <div style="overflow-x:auto">
    <div style="white-space:nowrap;margin-bottom:8px">${connectors}</div>
    <div style="white-space:nowrap">${details}</div>
  </div>`
}

function inlineMarkdown(text: string, style: CVStyle): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${style.fgColor};font-weight:700">$1</strong>`)
    .replace(/`([^`]+)`/g, `<code style="color:${style.accentColor};background:${style.codeBgColor};padding:0 3px;border-radius:3px">$1</code>`)
}

function renderPlainContent(content: string, style: CVStyle): string {
  const lines = content.split('\n').map((line) => {
    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      return `<div style="font-weight:600;color:${style.fgColor}">${escapeHtml(line)}</div>`
    }
    const escaped = escapeHtml(line)
    return `<div style="min-height:1.4em">${inlineMarkdown(escaped, style) || '&nbsp;'}</div>`
  })
  return lines.join('')
}

function cvToHtml(cv: CV): string {
  const { meta, sections, style } = cv
  const fs = style.fontSize

  const contactLinks: { label: string; href: string }[] = [
    meta.email    ? { label: meta.email,                          href: `mailto:${meta.email}` }                         : null,
    meta.github   ? { label: `github.com/${meta.github}`,        href: `https://github.com/${meta.github}` }            : null,
    meta.linkedin ? { label: `linkedin.com/in/${meta.linkedin}`, href: `https://linkedin.com/in/${meta.linkedin}` }     : null,
    meta.website  ? { label: meta.website,                       href: meta.website.startsWith('http') ? meta.website : `https://${meta.website}` } : null,
    meta.location ? { label: meta.location,                      href: '' }                                              : null,
  ].filter(Boolean) as { label: string; href: string }[]

  const contactHtml = contactLinks
    .map(({ label, href }) =>
      href
        ? `<a href="${href}" style="color:${style.accentColor};text-decoration:none;display:block">${escapeHtml(label)}</a>`
        : `<span style="color:${style.mutedColor};display:block">${escapeHtml(label)}</span>`
    )
    .join('')

  const sectionsHtml = sections
    .map((section) => {
      const isTimeline =
        (section.type === 'experience' || section.type === 'education') &&
        section.layout !== 'list'

      let contentHtml = ''
      if (section.type === 'photo') {
        const clipped = section.photoAscii
          ? clipAscii(section.photoAscii, section.photoHeight ?? 40)
          : null
        contentHtml = clipped
          ? `<pre style="font-family:inherit;font-size:${Math.max(fs - 3, 8)}px;line-height:1;white-space:pre;background:${style.codeBgColor};padding:12px;border-radius:4px;margin:0">${escapeHtml(clipped)}</pre>`
          : `<span style="color:${style.mutedColor};font-style:italic">&lt;!-- upload a photo to generate ASCII art --&gt;</span>`
      } else if (isTimeline) {
        contentHtml =
          section.layout === 'horizontal'
            ? renderTimelineHorizontal(section.content, style)
            : renderTimelineVertical(section.content, style)
      } else {
        contentHtml = renderPlainContent(section.content, style)
      }

      return `
      <div style="margin-bottom:28px">
        <div style="font-size:${Math.round(fs * 1.1)}px;font-weight:700;color:${style.fgColor};letter-spacing:0.03em">## ${escapeHtml(section.title)}</div>
        ${section.subtitle ? `<div style="color:${style.mutedColor};margin-top:2px">${escapeHtml(section.subtitle)}</div>` : ''}
        <div style="color:${style.borderColor};margin-top:3px;letter-spacing:-1px">${'─'.repeat(56)}</div>
        <div style="margin-top:8px">${contentHtml}</div>
      </div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${style.fontFamily};
    font-size: ${fs}px;
    color: ${style.fgColor};
    background: ${style.bgColor};
    line-height: 1.6;
    padding: 40px 48px;
    max-width: 860px;
    margin: 0 auto;
  }
</style>
</head>
<body>
  <div style="margin-bottom:32px">
    <div style="display:flex;gap:24px;align-items:flex-start">
      <div style="flex:1">
        <div style="font-size:${Math.round(fs * 2)}px;font-weight:700;color:${style.fgColor};letter-spacing:0.02em"># ${escapeHtml(meta.name)}</div>
        ${meta.title ? `<div style="font-size:${Math.round(fs * 1.3)}px;color:${style.mutedColor};margin-top:4px">${escapeHtml(meta.title)}</div>` : ''}
        <div style="margin-top:10px;line-height:1.8">${contactHtml}</div>
      </div>
      ${meta.photoAscii ? `<pre style="font-family:inherit;font-size:${Math.max(fs - 4, 7)}px;line-height:1;white-space:pre;color:${style.mutedColor};margin:0;flex-shrink:0">${escapeHtml(clipAscii(meta.photoAscii, meta.photoHeight ?? 25))}</pre>` : ''}
    </div>
    <div style="margin-top:12px;color:${style.borderColor};letter-spacing:-1px">${'═'.repeat(60)}</div>
  </div>
  ${sectionsHtml}
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const cv: CV = await req.json()

    const browser = await getBrowser()
    const page = await browser.newPage()

    await page.setContent(cvToHtml(cv), { waitUntil: 'networkidle0' })

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      printBackground: true,
    })

    await browser.close()

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="cv.pdf"',
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
