// Chrome rejects windows.create when less than half the window would sit on a
// visible display. Keep the detached popup inside the anchor window, whose
// top edge is the part most likely to be on screen.
export function placeDetachedPopup(anchor, size) {
  const left = Number.isFinite(anchor?.left) ? anchor.left : 0
  const top = Number.isFinite(anchor?.top) ? anchor.top : 0
  const width = Number.isFinite(anchor?.width) ? anchor.width : size.width
  const height = Number.isFinite(anchor?.height) ? anchor.height : size.height
  const rawLeft = left + width - size.width - 16
  const rawTop = top + 48
  return {
    left: Math.round(clamp(rawLeft, left, left + Math.max(0, width - size.width))),
    top: Math.round(clamp(rawTop, top, top + Math.max(0, height - size.height))),
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}
