export function pageAccessError(url) {
  if (!url) return "This page can't be inspected."
  try {
    const { protocol } = new URL(url)
    if (protocol === 'http:' || protocol === 'https:') return null
  } catch {
    return "This page can't be inspected."
  }
  return "This page can't be inspected."
}
