import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

const PALETTES = {
  standard: ' .:-=+*#%@',
  balanced: ' ░▒▓█',
  detailed: ' `.-\':_,^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@',
} as const

function toHex(r: number, g: number, b: number) {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function imageToAscii(
  pixels: Buffer,
  width: number,
  height: number,
  palette: keyof typeof PALETTES = 'balanced',
  maxCols = 80,
  maxRows = 40,
  saturationBoost = 0.75,
): { ascii: string; colors: string[][] } {
  const chars = PALETTES[palette]

  // Browser monospace at lineHeight:1 → char height ≈ 1.7× char width.
  const colsFromRows = Math.floor((maxRows * width * 1.7) / height)
  const cols = Math.max(1, Math.min(maxCols, colsFromRows))
  const charWidth = width / cols
  const charHeight = charWidth * 1.7
  const rows = Math.max(1, Math.min(maxRows, Math.floor(height / charHeight)))

  const lines: string[] = []
  const colorRows: string[][] = []

  for (let row = 0; row < rows; row++) {
    let line = ''
    const colorLine: string[] = []
    const y0 = Math.floor(row * charHeight)
    const y1 = Math.min(height, Math.max(y0 + 1, Math.floor((row + 1) * charHeight)))

    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor(col * charWidth)
      const x1 = Math.min(width, Math.max(x0 + 1, Math.floor((col + 1) * charWidth)))

      // Average colour over the cell — gives smoother, more representative tones.
      let rSum = 0, gSum = 0, bSum = 0, n = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * width + x) * 3
          rSum += pixels[idx]
          gSum += pixels[idx + 1]
          bSum += pixels[idx + 2]
          n++
        }
      }
      let r = rSum / n, g = gSum / n, b = bSum / n

      const luma = 0.299 * r + 0.587 * g + 0.114 * b

      // Compress luma toward mid-grey to soften contrast between neighbours.
      // factor < 1 narrows the dynamic range; the chroma is still preserved.
      const lumaCompress = 0.7
      const targetLuma = 128 + (luma - 128) * lumaCompress
      const lumaShift = targetLuma - luma

      // Saturation: < 1 desaturates, > 1 boosts. Default desaturates slightly so
      // adjacent cells don't read as "harsh" primaries.
      r = Math.max(0, Math.min(255, (luma + lumaShift) + (r - luma) * saturationBoost))
      g = Math.max(0, Math.min(255, (luma + lumaShift) + (g - luma) * saturationBoost))
      b = Math.max(0, Math.min(255, (luma + lumaShift) + (b - luma) * saturationBoost))

      const charIdx = Math.floor((luma / 255) * (chars.length - 1))
      line += chars[charIdx]
      colorLine.push(toHex(Math.round(r), Math.round(g), Math.round(b)))
    }
    lines.push(line)
    colorRows.push(colorLine)
  }

  return { ascii: lines.join('\n'), colors: colorRows }
}

export async function POST(req: NextRequest) {
  try {
    const {
      dataUrl,
      palette = 'balanced',
      maxCols = 80,
      maxRows = 40,
      saturationBoost = 0.75,
    } = await req.json()

    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'Invalid image data' }, { status: 400 })
    }

    const base64 = dataUrl.split(',')[1]
    const buffer = Buffer.from(base64, 'base64')

    // Resize wide enough to give multiple source pixels per cell even at 200+ cols.
    const sourceWidth = Math.min(2048, Math.max(640, maxCols * 8))

    const { data, info } = await sharp(buffer)
      .resize({ width: sourceWidth, withoutEnlargement: true })
      .flatten({ background: '#000000' })
      .toColorspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true })

    const { ascii, colors } = imageToAscii(
      data,
      info.width,
      info.height,
      palette,
      maxCols,
      maxRows,
      saturationBoost,
    )

    return NextResponse.json({ ascii, colors })
  } catch (err) {
    console.error('ASCII generation error:', err)
    return NextResponse.json({ error: 'Failed to generate ASCII art' }, { status: 500 })
  }
}
