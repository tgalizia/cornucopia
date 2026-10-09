import { afterEach, describe, expect, it } from 'vitest'
import { extensionContextAlive, invalidatedError } from '../src/shared/extension-context.js'

describe('extension context', () => {
  afterEach(() => {
    delete globalThis.chrome
  })

  it('recognizes a disconnected content script', () => {
    expect(invalidatedError(new Error('Extension context invalidated.'))).toBe(true)
    expect(invalidatedError(new Error('Could not establish connection. Receiving end does not exist.'))).toBe(false)
  })

  it('treats a missing runtime id as disconnected', () => {
    expect(extensionContextAlive()).toBe(false)
    globalThis.chrome = { runtime: { id: 'cornucopia' } }
    expect(extensionContextAlive()).toBe(true)
    globalThis.chrome = {
      runtime: {
        get id() {
          throw new Error('Extension context invalidated.')
        },
      },
    }
    expect(extensionContextAlive()).toBe(false)
  })
})
