export function placeNearPointer(node, x, y, offset = 16, margin = 8) {
  node.hidden = false
  node.style.left = `${x + offset}px`
  node.style.top = `${y + offset}px`
  const rect = node.getBoundingClientRect()
  let left = x + offset
  let top = y + offset
  if (rect.width > 0 && rect.right > window.innerWidth - margin) {
    left = x - offset - rect.width
  }
  if (rect.height > 0 && rect.bottom > window.innerHeight - margin) {
    top = y - offset - rect.height
  }
  node.style.left = `${Math.max(margin, left)}px`
  node.style.top = `${Math.max(margin, top)}px`
}
