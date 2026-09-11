import { describe, it, expect } from 'vitest'
import {
  dataUrlBytes,
  fittedSize,
  formatBytes,
  imagesBytes,
  isImageDataUrl,
  labelFromFileName,
  MAX_IMAGE_BYTES,
  ENCODE_STEPS,
} from '~/services/characterArt'
import { CharacterSchema } from '~/schemas/characterSchema'
import { validCharacter } from '../fixtures'

// A 1x1 GIF — the smallest real image data URL there is.
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

describe('fittedSize', () => {
  it('scales the longest edge down to the budget', () => {
    expect(fittedSize(4000, 3000, 1200)).toEqual({ width: 1200, height: 900 })
    expect(fittedSize(3000, 4000, 1200)).toEqual({ width: 900, height: 1200 })
  })

  it('leaves an image already inside the budget alone', () => {
    expect(fittedSize(400, 250, 1200)).toEqual({ width: 400, height: 250 })
  })

  it('never rounds an edge away to nothing', () => {
    expect(fittedSize(4000, 3, 1200)).toEqual({ width: 1200, height: 1 })
  })

  it('survives an image that has not reported its size', () => {
    expect(fittedSize(0, 0, 1200)).toEqual({ width: 0, height: 0 })
  })
})

describe('dataUrlBytes', () => {
  it('counts the decoded bytes, not the base64', () => {
    // "hi" is 2 bytes; its base64 is 4 characters with one pad.
    expect(dataUrlBytes('data:image/png;base64,aGk=')).toBe(2)
  })

  it('is zero for something that is not a data URL', () => {
    expect(dataUrlBytes('nonsense')).toBe(0)
  })

  it('sums a character\'s pictures', () => {
    expect(imagesBytes([
      { id: 'a', label: '', data: PIXEL },
      { id: 'b', label: '', data: PIXEL },
    ])).toBe(2 * dataUrlBytes(PIXEL))
    expect(imagesBytes(undefined)).toBe(0)
  })
})

describe('isImageDataUrl', () => {
  it('accepts the raster types an upload produces', () => {
    expect(isImageDataUrl(PIXEL)).toBe(true)
    expect(isImageDataUrl('data:image/webp;base64,AAAA')).toBe(true)
    expect(isImageDataUrl('data:image/jpeg;base64,AAAA')).toBe(true)
  })

  it('rejects anything that is not a base64 raster image', () => {
    expect(isImageDataUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false)
    expect(isImageDataUrl('data:image/svg+xml;base64,AAAA')).toBe(false)
    expect(isImageDataUrl('https://example.com/portrait.png')).toBe(false)
    expect(isImageDataUrl('javascript:alert(1)')).toBe(false)
  })
})

describe('labelFromFileName', () => {
  it('reads a caption out of the file name', () => {
    expect(labelFromFileName('half-orc_no armor.png')).toBe('half orc no armor')
    expect(labelFromFileName('portrait.jpeg')).toBe('portrait')
  })

  it('caps a name long enough to break the layout', () => {
    expect(labelFromFileName(`${'a'.repeat(200)}.png`)).toHaveLength(60)
  })
})

describe('encoding budget', () => {
  it('steps down in both size and quality', () => {
    const edges = ENCODE_STEPS.map(s => s.edge)
    const qualities = ENCODE_STEPS.map(s => s.quality)
    expect([...edges].sort((a, b) => b - a)).toEqual(edges)
    expect([...qualities].sort((a, b) => b - a)).toEqual(qualities)
    expect(MAX_IMAGE_BYTES).toBeGreaterThan(0)
  })

  it('formats a size a player can read', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })
})

describe('CharacterSchema images', () => {
  it('carries pictures through an import', () => {
    const result = CharacterSchema.safeParse({
      ...validCharacter,
      images: [{ id: 'img-1', label: 'In plate', data: PIXEL }],
    })
    expect(result.success).toBe(true)
    expect(result.success && result.data.images).toEqual([
      { id: 'img-1', label: 'In plate', data: PIXEL },
    ])
  })

  it('accepts a character with no pictures at all', () => {
    const result = CharacterSchema.safeParse(validCharacter)
    expect(result.success).toBe(true)
    expect(result.success && result.data.images).toBeUndefined()
  })

  it('refuses a picture whose data is not an image', () => {
    const result = CharacterSchema.safeParse({
      ...validCharacter,
      images: [{ id: 'img-1', label: 'x', data: 'data:text/html;base64,PHNjcmlwdD4=' }],
    })
    expect(result.success).toBe(false)
  })
})
