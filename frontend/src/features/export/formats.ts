/**
 * What an export makes: one file per format a person picks, named after the document.
 *
 * The app says what its formats are and how to make each. Everything here is pure, so
 * the files an export would write can be tested without writing any.
 */

import {safeFileName} from '../../core/files'

/** One kind of file a document can be exported as. */
export interface ExportFormat<T> {
    readonly id: string
    /** What the choice says, such as "Markdown". */
    readonly label: string
    /** The file name's ending, without the dot. */
    readonly extension: string
    /** One line on what it's good for. */
    readonly help?: string
    /** The file's contents. Text is written as UTF-8. */
    make(content: T, name: string): string | Uint8Array
}

export interface ExportFile {
    readonly name: string
    readonly bytes: Uint8Array
}

/** A document's name as a file name, or a plain one when nothing of it can be used. */
export const exportName = (name: string): string => safeFileName(name, 'Export')

/** The files exporting content as these formats makes, in the formats' order. */
export function exportFiles<T>(formats: readonly ExportFormat<T>[], name: string, content: T): ExportFile[] {
    const base = exportName(name)

    return formats.map((format) => {
        const made = format.make(content, name)

        return {name: `${base}.${format.extension}`, bytes: typeof made === 'string' ? new TextEncoder().encode(made) : made}
    })
}

/**
 * Names for several documents' files that never clash: two documents both called
 * "Shopping" become "Shopping" and "Shopping 2", whatever case they're written in,
 * since Windows and a Mac treat those names as one.
 */
export function uniqueNames(names: readonly string[]): string[] {
    const taken = new Set<string>()

    return names.map((name) => {
        const base = exportName(name)
        let candidate = base
        let count = 2

        while (taken.has(candidate.toLowerCase())) {
            candidate = `${base} ${count}`
            count += 1
        }

        taken.add(candidate.toLowerCase())

        return candidate
    })
}

/** "1 file is", "3 files are": for saying how many are in the way. */
export const filesAre = (count: number): string => (count === 1 ? '1 file is' : `${count} files are`)
