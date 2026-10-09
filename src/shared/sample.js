export function pixelOffset(x, y, innerWidth, innerHeight, imageWidth, imageHeight) {
  if (innerWidth <= 0 || innerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { x: 0, y: 0 }
  }
  const px = Math.round((x / innerWidth) * imageWidth)
  const py = Math.round((y / innerHeight) * imageHeight)
  return {
    x: Math.min(imageWidth - 1, Math.max(0, px)),
    y: Math.min(imageHeight - 1, Math.max(0, py)),
  }
}

export async function sampleDataUrl(dataUrl, x, y, innerWidth, innerHeight) {
  const blob = await (await fetch(dataUrl)).blob()
  const bitmap = await createImageBitmap(blob)
  try {
    const point = pixelOffset(x, y, innerWidth, innerHeight, bitmap.width, bitmap.height)
    const canvas = new OffscreenCanvas(1, 1)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.imageSmoothingEnabled = false
    context.drawImage(bitmap, point.x, point.y, 1, 1, 0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    return { r, g, b }
  } finally {
    bitmap.close?.()
  }
}
