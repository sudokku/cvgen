'use client'

import { useEffect, useRef } from 'react'

interface AsciiArtProps {
  ascii: string
  colors?: string[][]
  /** Visual width in baseline (density=1) cols — drives bounding box size. */
  baseCols: number
  /** Density multiplier the ascii was generated at (1, 2, 3). */
  density: number
  /** Reference font size (px) used at density=1. Final font scales as base/density. */
  baseFontSize: number
  /** Fallback colour when no per-cell color array is available. */
  fallbackColor: string
  /** Optional background colour. */
  background?: string
  padding?: string
  borderRadius?: string
}

/**
 * Renders ASCII art with per-character color spans. Font size scales inversely
 * with density so that increasing density produces more "pixels" within the
 * same bounding box, not a larger image.
 */
export function AsciiArt({
  ascii,
  colors,
  baseCols,
  density,
  baseFontSize,
  fallbackColor,
  background,
  padding,
  borderRadius,
}: AsciiArtProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lines = ascii.split('\n')
  const fontSize = Math.max(2, baseFontSize / density)
  const hasColors = !!colors && colors.length === lines.length

  // Stable bounding box: width = baseCols × (baseFontSize / 1.7), independent of density.
  const targetWidthPx = baseCols * (baseFontSize / 1.7)
  const heightPx = lines.length * fontSize
  const longestLine = Math.max(1, ...lines.map((line) => Array.from(line).length))
  const charWidth = targetWidthPx / longestLine

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const scale = window.devicePixelRatio || 1
    canvas.width = Math.ceil(targetWidthPx * scale)
    canvas.height = Math.ceil(heightPx * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(scale, scale)
    ctx.clearRect(0, 0, targetWidthPx, heightPx)
    if (background) {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, targetWidthPx, heightPx)
    }
    ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`
    ctx.textBaseline = 'top'

    for (let r = 0; r < lines.length; r++) {
      const chars = Array.from(lines[r])
      for (let c = 0; c < chars.length; c++) {
        ctx.fillStyle = hasColors ? colors![r]?.[c] ?? fallbackColor : fallbackColor
        ctx.fillText(chars[c], c * charWidth, r * fontSize)
      }
    }
  }, [background, charWidth, colors, fallbackColor, fontSize, hasColors, heightPx, lines, targetWidthPx])

  return (
    <canvas
      ref={canvasRef}
      role="presentation"
      style={{
        display: 'block',
        flexShrink: 0,
        background,
        padding,
        borderRadius,
        width: `${targetWidthPx}px`,
        height: `${heightPx}px`,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      aria-hidden="true"
    />
  )
}
