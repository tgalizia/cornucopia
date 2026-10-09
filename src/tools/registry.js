import { mountTypography } from './typography/index.js'
import { mountColor } from './color/index.js'
import { mountMeasure } from './measure/index.js'
import { mountGrid } from './grid/index.js'

export const tools = [
  {
    id: 'typography',
    label: 'Typography',
    kind: 'page',
    hint: 'Font, size, line-height, and color under the pointer',
    pageHint: 'Move over text. Copy CSS stays in the top-right. Esc exits.',
    mount: mountTypography,
  },
  {
    id: 'color',
    label: 'Color picker',
    kind: 'page',
    hint: 'Pixel under the pointer, saved on click',
    pageHint: 'The readout follows the pointer. Click to save it. Esc exits.',
    mount: mountColor,
  },
  {
    id: 'measure',
    label: 'Measure',
    kind: 'page',
    hint: 'Element box or a free rectangle',
    pageHint: 'Hover an element, or drag a rectangle. Esc exits.',
    mount: mountMeasure,
  },
  {
    id: 'grid',
    label: 'Grid',
    kind: 'page',
    hint: 'Baseline grid, resizable while on',
    pageHint: 'Pick 4, 8, 12, or 16, or type a size from 1 to 128 and press Enter. A stronger line falls every 8 steps. Esc exits.',
    mount: mountGrid,
  },
  {
    id: 'viewport',
    label: 'Viewport',
    kind: 'popup',
    hint: 'Resize the window to a viewport preset',
  },
  {
    id: 'clear-data',
    label: 'Clear site data',
    kind: 'popup',
    hint: 'Cookies and storage for this site',
  },
]

export function getPageTool(id) {
  return tools.find((tool) => tool.id === id && tool.kind === 'page') ?? null
}
