/**
 * Small helpers for files: safe names, data URLs and folders.
 */

/** Characters no system allows in a file name. Control characters are left out too. */
const UNSAFE = new Set('\\/:*?"<>|')

/** A name made safe for a file on every system, or `fallback` when nothing of it is left. */
export function safeFileName(name: string, fallback: string): string {
    const kept = [...name].map((character) => (UNSAFE.has(character) || character.charCodeAt(0) < 32 ? ' ' : character)).join('')
    // Dots that start a name hide a file on a Mac, and the space they leave goes too.
    const safe = kept.replace(/\s+/g, ' ').trim().replace(/^\.+/, '').trim()

    return safe || fallback
}

/** The bytes of a PNG data URL. */
export function bytesOfDataUrl(dataUrl: string): Uint8Array {
    const comma = dataUrl.indexOf(',')
    const binary = atob(comma === -1 ? dataUrl : dataUrl.slice(comma + 1))
    const bytes = new Uint8Array(binary.length)

    for (let at = 0; at < binary.length; at++) {
        bytes[at] = binary.charCodeAt(at)
    }

    return bytes
}

/** The folder a saved file is in, for Show the files. */
export function folderOf(path: string): string | undefined {
    const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))

    return cut > 0 ? path.slice(0, cut) : undefined
}
