import React from 'react'

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
  const lines = ascii.split('\n')
  const fontSize = Math.max(2, baseFontSize / density)
  const hasColors = !!colors && colors.length === lines.length

  // Stable bounding box: width = baseCols × (baseFontSize / 1.7), independent of density.
  const targetWidthPx = baseCols * (baseFontSize / 1.7)

  return (
    <pre
      style={{
        fontFamily: 'inherit',
        fontSize: `${fontSize}px`,
        lineHeight: 1,
        margin: 0,
        whiteSpace: 'pre',
        flexShrink: 0,
        color: fallbackColor,
        background,
        padding,
        borderRadius,
        width: `${targetWidthPx}px`,
        // Prevent sub-pixel jitter between rows on retina.
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {lines.map((line, r) => (
        <div key={r} style={{ display: 'block', height: `${fontSize}px`, lineHeight: 1 }}>
          {hasColors
            ? Array.from(line).map((ch, c) => (
                <span key={c} style={{ color: colors![r]?.[c] ?? fallbackColor }}>
                  {ch}
                </span>
              ))
            : line}
        </div>
      ))}
    </pre>
  )
}
