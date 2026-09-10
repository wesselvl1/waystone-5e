/**
 * A minimal zip reader, enough to unpack a rulepack bundle produced by
 * scripts/pack-rulepacks.mjs (or by any ordinary zip tool).
 *
 * The browser already ships the hard part — DecompressionStream inflates deflate —
 * so all that is left is walking the central directory. That keeps a zip dependency
 * out of a bundle whose only use for one is the import screen.
 *
 * Deliberately not supported, each rejected with a message rather than silently
 * mis-read: encryption, zip64 (>4 GB or >65535 entries), and compression methods other
 * than store (0) and deflate (8).
 */

export interface ZipEntry {
  /** Path within the archive, e.g. `tcoe/subclasses.json`. */
  path: string
  bytes: Uint8Array
}

const LOCAL_HEADER_SIG = 0x04034B50
const CENTRAL_HEADER_SIG = 0x02014B50
const END_OF_CENTRAL_DIR_SIG = 0x06054B50

/** First four bytes of any zip: `PK\x03\x04`. */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4
    && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04
}

/**
 * The end-of-central-directory record sits at the very end, unless the archive carries a
 * trailing comment — so scan backwards for its signature over the largest comment a
 * 16-bit length field allows.
 */
function findEndOfCentralDir(view: DataView): number {
  const start = Math.max(0, view.byteLength - 22 - 0xFFFF)
  for (let i = view.byteLength - 22; i >= start; i--) {
    if (view.getUint32(i, true) === END_OF_CENTRAL_DIR_SIG) return i
  }
  return -1
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new TypeError('This browser cannot read compressed zips (DecompressionStream is missing)')
  }
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Read every file in a zip. Directory entries are skipped; entry order is the archive's
 * own, which the packing script writes in merge order.
 */
export async function readZip(input: ArrayBuffer | Uint8Array): Promise<ZipEntry[]> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  const eocd = findEndOfCentralDir(view)
  if (eocd === -1) throw new Error('Not a valid zip file (no end-of-central-directory record)')

  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  if (count === 0xFFFF || offset === 0xFFFFFFFF) {
    throw new Error('Zip64 archives are not supported')
  }

  const decoder = new TextDecoder()
  const entries: ZipEntry[] = []

  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== CENTRAL_HEADER_SIG) {
      throw new Error('Corrupt zip: central directory entry expected')
    }

    const flags = view.getUint16(offset + 8, true)
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    offset += 46 + nameLength + extraLength + commentLength

    // Directory entries carry no data
    if (path.endsWith('/')) continue

    if (flags & 0x0001) throw new Error(`Encrypted zip entries are not supported (${path})`)
    if (compressedSize === 0xFFFFFFFF || uncompressedSize === 0xFFFFFFFF) {
      throw new Error(`Zip64 entries are not supported (${path})`)
    }
    if (method !== 0 && method !== 8) {
      throw new Error(`Unsupported compression method ${method} in ${path}`)
    }

    if (view.getUint32(localOffset, true) !== LOCAL_HEADER_SIG) {
      throw new Error(`Corrupt zip: bad local header for ${path}`)
    }
    // The local header's own name/extra lengths may differ from the central directory's,
    // so the data offset has to come from the local header.
    const dataStart = localOffset + 30
      + view.getUint16(localOffset + 26, true)
      + view.getUint16(localOffset + 28, true)
    const raw = bytes.subarray(dataStart, dataStart + compressedSize)

    entries.push({ path, bytes: method === 8 ? await inflateRaw(raw) : raw })
  }

  return entries
}
