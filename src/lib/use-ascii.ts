import { useCallback, useRef } from 'react'

interface AsciiOptions {
  cols?: number
}

/**
 * Returns a stable `generate` function that calls /api/ascii and returns the ASCII string.
 * Cancels in-flight requests if called again before the previous one resolves.
 */
export function useAsciiGenerator() {
  const abortRef = useRef<AbortController | null>(null)

  const generate = useCallback(async (dataUrl: string, opts: AsciiOptions = {}): Promise<string | null> => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/ascii', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl, cols: opts.cols ?? 80 }),
        signal: controller.signal,
      })
      const { ascii } = await res.json()
      return ascii as string
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return null
      console.error('ASCII generation failed', err)
      return null
    }
  }, [])

  return generate
}

/** Clips ASCII art to a maximum number of rows. */
export function clipAscii(ascii: string, maxRows: number): string {
  const lines = ascii.split('\n')
  return lines.slice(0, maxRows).join('\n')
}
