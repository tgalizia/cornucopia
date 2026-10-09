const DOCS_FONT = /^(?:(italic|oblique)\s+)?(?:(normal|bold|[1-9]00)\s+)?(\d*\.?\d+(?:px|pt|em|rem))(?:\/(\S+))?\s+(\S(?:.*\S)?)$/i

export const MISSING = '—'

export function parseDocsFont(value) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(DOCS_FONT)
  if (!match) return null
  return {
    style: (match[1] || 'normal').toLowerCase(),
    weight: (match[2] || '400').toLowerCase(),
    size: match[3],
    lineHeight: match[4] || MISSING,
    family: match[5],
    letterSpacing: MISSING,
    color: MISSING,
    align: MISSING,
    transform: MISSING,
  }
}
