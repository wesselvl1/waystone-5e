import type { CharacterImage } from '~/types/character'

/**
 * Turning a picked file into something a character can carry.
 *
 * Every image is re-encoded rather than stored as picked, because what is stored is what
 * gets exported: a 4 MB phone photo is 5.3 MB of base64 in the character's JSON, in every
 * copy of it, and in the IndexedDB record the sheet reads on each load. Downscaling to a
 * size the sheet can actually show costs the player nothing they can see and keeps a
 * character a file that can still be mailed to a DM.
 *
 * Re-encoding also drops the EXIF block, and with it the GPS tag a phone writes into it —
 * a sheet is shared, and the picture of someone's mini should not carry their address.
 * The cost is that an animated GIF flattens to its first frame.
 */

/** How many pictures one character may hold. */
export const MAX_IMAGES = 12

/** The size a stored picture may not exceed once encoded. */
export const MAX_IMAGE_BYTES = 1_200_000

/**
 * Encoding attempts, in order, until one comes in under the cap.
 *
 * A ladder rather than a single setting because the two failure modes pull opposite ways:
 * most pictures are comfortably small at the first rung, and the rare noisy photograph
 * that is not would have to be stored at a quality nobody wants for the rest to be safe.
 */
export const ENCODE_STEPS: { edge: number; quality: number }[] = [
  { edge: 1200, quality: 0.82 },
  { edge: 1000, quality: 0.7 },
  { edge: 800, quality: 0.6 },
]

/** Raster types accepted on import. SVG is excluded: uploads never produce one. */
const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=\s]+$/

/** Whether a stored `data` string is an image this app would have written. */
export function isImageDataUrl(value: string): boolean {
  return IMAGE_DATA_URL.test(value)
}

/**
 * The box `width` x `height` fits into with its aspect ratio intact, never enlarged —
 * a 400px token stays 400px rather than being blown up to the budget and re-encoded
 * into a bigger, blurrier copy of itself.
 */
export function fittedSize(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= 0) return { width: 0, height: 0 }
  const scale = Math.min(1, maxEdge / longest)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** Decoded byte count of a base64 data URL, for checking one against the cap. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return 0
  const body = dataUrl.slice(comma + 1)
  if (!/;base64$/i.test(dataUrl.slice(0, comma))) return body.length
  const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor(body.length * 3 / 4) - padding)
}

/**
 * A first caption from the file name — "half-orc_no-armor.png" becomes "half orc no
 * armor". Worth guessing at: someone uploading two pictures of the same character has
 * usually already named them for the difference, and an empty caption on both is what
 * makes the pair unreadable a month later.
 */
export function labelFromFileName(name: string): string {
  const stem = name.replace(/\.[^.]+$/, '')
  return stem.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
}

/** Sum of the stored pictures, so the sheet can say what a character is carrying. */
export function imagesBytes(images: CharacterImage[] | undefined): number {
  return (images ?? []).reduce((sum, image) => sum + dataUrlBytes(image.data), 0)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── browser side ──────────────────────────────────────────────────────────────
// Everything below needs a DOM, so it is kept apart from the pure helpers above:
// the unit tests run under vitest's `node` environment, where a canvas does not exist.

let webpSupport: boolean | undefined

/**
 * Whether this browser encodes WebP. Safari before 14 does not, and `toDataURL` answers
 * an unsupported type by quietly handing back a PNG — several times the size, which is
 * precisely what this module exists to avoid. Asked once and remembered.
 */
function supportsWebp(): boolean {
  if (webpSupport === undefined) {
    const probe = document.createElement('canvas')
    probe.width = 1
    probe.height = 1
    webpSupport = probe.toDataURL('image/webp').startsWith('data:image/webp')
  }
  return webpSupport
}

async function decodeImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  }
  catch {
    throw new Error('could not be read as an image')
  }
  finally {
    // Safe once decoded: the element holds the pixels, not the URL.
    URL.revokeObjectURL(url)
  }
}

function encode(img: HTMLImageElement, edge: number, quality: number): string {
  const source = {
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
  }
  const size = fittedSize(source.width, source.height, edge)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('this browser could not process the image')

  // JPEG has no alpha, so a transparent PNG would composite onto black. White is what
  // the player drew the art against; the dark sheet frames it either way.
  const webp = supportsWebp()
  if (!webp) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size.width, size.height)
  }
  ctx.drawImage(img, 0, 0, size.width, size.height)

  return canvas.toDataURL(webp ? 'image/webp' : 'image/jpeg', quality)
}

/**
 * Read a picked file into a storable picture, or throw with a reason the sheet can show.
 *
 * The thrown messages are written to be printed after the file name ("hero.txt: is not
 * an image"), since a failed upload is nearly always one file out of several.
 */
export async function readCharacterImage(file: File): Promise<CharacterImage> {
  if (!file.type.startsWith('image/')) throw new Error('is not an image')

  const img = await decodeImage(file)

  for (const step of ENCODE_STEPS) {
    const data = encode(img, step.edge, step.quality)
    if (dataUrlBytes(data) <= MAX_IMAGE_BYTES) {
      return { id: crypto.randomUUID(), label: labelFromFileName(file.name), data }
    }
  }

  throw new Error('is too detailed to store — try a smaller crop')
}
