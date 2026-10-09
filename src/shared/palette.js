const KEY = 'palette'
const MAX_COLORS = 20

export async function readPalette() {
  const data = await chrome.storage.session.get(KEY)
  return Array.isArray(data[KEY]) ? data[KEY] : []
}

export async function addPaletteEntry(entry) {
  const palette = await readPalette()
  const next = [entry, ...palette.filter((color) => color.hex !== entry.hex)].slice(0, MAX_COLORS)
  await chrome.storage.session.set({ [KEY]: next })
  return next
}

export async function clearPalette() {
  await chrome.storage.session.set({ [KEY]: [] })
  return []
}
