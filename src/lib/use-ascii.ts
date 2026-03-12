import { useCallback, useRef } from 'react'

interface AsciiOptions {
  maxCols?: number
  maxRows?: number
}

/**
 * Compresses an image dataUrl to a smaller JPEG using a canvas element.
 * Limits the longest dimension to `maxDim` pixels and encodes at the given quality.
 */
function compressImage(dataUrl: string, maxDim = 800, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = dataUrl
  })
}

/**
 * Returns a stable `generate` function that calls /api/ascii and returns the ASCII string.
 * Compresses the image client-side before sending to avoid large payload failures.
 * Cancels in-flight requests if called again before the previous one resolves.
 */
export function useAsciiGenerator() {
  const abortRef = useRef<AbortController | null>(null)

  const generate = useCallback(async (dataUrl: string, opts: AsciiOptions = {}): Promise<string | null> => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const compressed = await compressImage(dataUrl)

      const res = await fetch('/api/ascii', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: compressed,
          maxCols: opts.maxCols ?? 80,
          maxRows: opts.maxRows ?? 40,
        }),
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
