/**
 * Opens a new window containing only the CV preview div,
 * copies all parent stylesheets into it, then triggers print.
 *
 * The div becomes the entire document — browsers reliably preserve
 * background colors because there is no white page beneath it.
 * window.open() MUST be called synchronously inside a click handler
 * or popup blockers will block it.
 */
export function printCV(elementId: string, filename = 'CV', bgColor = '#000000'): void {
  const element = document.getElementById(elementId)
  if (!element) return

  const printWindow = window.open('', '_blank', 'width=900,height=650')
  if (!printWindow) {
    alert('Allow popups for this site to export your CV as PDF.')
    return
  }

  // Copy every <style> and <link rel="stylesheet"> from the parent page.
  // In Next.js dev these are <style> tags; in production they are <link> tags — both work.
  const stylesheets = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]')
  )
    .map((n) => n.outerHTML)
    .join('\n')

  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${filename}</title>
  ${stylesheets}
  <style>
    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page { margin: 0; size: A4; }
    html, body { margin: 0; padding: 0; background: ${bgColor}; }
    #cv-preview { -webkit-box-decoration-break: clone; box-decoration-break: clone; }
  </style>
</head>
<body>
  ${element.outerHTML}
</body>
</html>`)

  printWindow.document.close()

  // Wait for fonts/images to load, then print.
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
      printWindow.addEventListener('afterprint', () => printWindow.close())
    }, 400)
  }
}
