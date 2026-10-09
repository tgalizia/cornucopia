function known(value) {
  return Boolean(value) && value !== '—'
}

function quoteFamily(family) {
  return String(family).split(',').map((part) => {
    const item = part.trim()
    if (!item || item.startsWith('"') || item.startsWith("'")) return item
    if (/[\s()]/.test(item)) return `'${item.replaceAll("'", "\\'")}'`
    return item
  }).join(', ')
}

export function fontCss(style) {
  if (!known(style.size) || !known(style.family)) return ''
  const parts = []
  if (known(style.style) && style.style !== 'normal') parts.push(style.style)
  if (known(style.weight) && style.weight !== '400' && style.weight !== 'normal') parts.push(style.weight)
  const size = known(style.lineHeight) && style.lineHeight !== 'normal'
    ? `${style.size}/${style.lineHeight}`
    : style.size
  parts.push(size)
  parts.push(quoteFamily(style.family))
  const lines = [`font: ${parts.join(' ')};`]
  if (known(style.color)) lines.push(`color: ${style.color};`)
  return lines.join('\n')
}
