/** Clips ASCII art to a maximum number of rows. */
export function clipAscii(ascii: string, maxRows: number): string {
  const lines = ascii.split('\n')
  return lines.slice(0, maxRows).join('\n')
}
