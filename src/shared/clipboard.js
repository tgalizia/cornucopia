export async function copyText(text) {
  if (copyWithCommand(text)) return true
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function copyWithCommand(text) {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;outline:0;opacity:0'
    const parent = document.documentElement || document.body
    if (!parent) return false
    parent.append(area)
    const selection = document.getSelection()
    const previous = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
    area.focus()
    area.select()
    const copied = document.execCommand('copy')
    area.remove()
    if (previous && selection) {
      selection.removeAllRanges()
      selection.addRange(previous)
    }
    return copied
  } catch {
    return false
  }
}
