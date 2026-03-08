import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

// ASCII palettes inspired by opencv2term's palette system
const PALETTES = {
  standard: ' .:-=+*#%@',
  balanced: ' ░▒▓█',
  detailed: ' `.-\':_,^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@',
} as const

function imageToAscii(
  pixels: Buffer,
  width: number,
  height: number,
  palette: keyof typeof PALETTES = 'balanced',
  maxCols = 80,
  maxRows = 40
): string {
  const chars = PALETTES[palette]

  // Fit image into maxCols × maxRows while preserving aspect ratio.
  // Browser monospace at lineHeight:1 → char height ≈ 1.7× char width.
  const colsFromRows = Math.floor((maxRows * width * 1.7) / height)
  const cols = Math.min(maxCols, colsFromRows)

  const charWidth = width / cols
  const charHeight = charWidth * 1.7
  const rows = Math.min(maxRows, Math.floor(height / charHeight))

  const lines: string[] = []

  for (let row = 0; row < rows; row++) {
    let line = ''
    for (let col = 0; col < cols; col++) {
      const px = Math.floor(col * charWidth)
      const py = Math.floor(row * charHeight)

      // Clamp to image bounds
      const safeX = Math.min(px, width - 1)
      const safeY = Math.min(py, height - 1)

      const idx = (safeY * width + safeX) * 3
      const r = pixels[idx]
      const g = pixels[idx + 1]
      const b = pixels[idx + 2]

      // Luma (perceptual brightness)
      const luma = 0.299 * r + 0.587 * g + 0.114 * b
      const charIdx = Math.floor((luma / 255) * (chars.length - 1))
      line += chars[charIdx]
    }
    lines.push(line)
  }

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const { dataUrl, palette = 'balanced', maxCols = 80, maxRows = 40 } = await req.json()

    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 })
    }

    const base64 = dataUrl.split(',')[1]
    const buffer = Buffer.from(base64, 'base64')

    const { data, info } = await sharp(buffer)
      .resize({ width: 320, withoutEnlargement: true })
      .toColorspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true })

    // sharp raw output is RGB (3 channels) after toColorspace
    const ascii = imageToAscii(data, info.width, info.height, palette, maxCols, maxRows)

    return NextResponse.json({ ascii })
  } catch (err) {
    console.error('ASCII generation error:', err)
    return NextResponse.json({ error: 'Failed to generate ASCII art' }, { status: 500 })
  }
}
