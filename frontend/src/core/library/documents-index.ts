/**
 * The index of saved documents: each one's summary, kept so the library page doesn't
 * read every file on every visit.
 *
 * It is a shortcut, never the truth. An entry is trusted only while its file's
 * size and time saved are the ones it was read at, and a damaged index is
 * simply built again from the files.
 */

import {z} from 'zod'
import type {DocumentSummary} from './document-summary'

export const DOCUMENTS_INDEX_VERSION = 1

export interface IndexedFile {
    readonly id: string
    readonly size: number
    readonly savedAt: string
}

interface IndexEntry {
    readonly size: number
    readonly savedAt: string
    readonly summary: DocumentSummary
}

export type DocumentsIndex = Readonly<Record<string, IndexEntry>>

const summarySchema = z.object({
    name: z.string(),
    kind: z.string().nullable(),
    createdAt: z.string().nullable(),
})

const indexSchema = z.object({
    version: z.literal(DOCUMENTS_INDEX_VERSION),
    documents: z.record(z.string(), z.object({size: z.number(), savedAt: z.string(), summary: summarySchema})),
})

/** The index in a file, or an empty one when it's missing, damaged or from another version. */
export function parseDocumentsIndex(text: string | null): DocumentsIndex {
    if (!text) {
        return {}
    }

    try {
        const result = indexSchema.safeParse(JSON.parse(text))

        return result.success ? result.data.documents : {}
    } catch {
        return {}
    }
}

export function serializeDocumentsIndex(index: DocumentsIndex): string {
    return JSON.stringify({version: DOCUMENTS_INDEX_VERSION, documents: index})
}

/**
 * The summary of every file, reading only those the index can't vouch for.
 * Files that are gone drop out of the index. `changed` says whether it's worth
 * writing back.
 */
export async function refreshDocumentsIndex(
    index: DocumentsIndex,
    files: readonly IndexedFile[],
    read: (id: string) => Promise<DocumentSummary>,
): Promise<{index: DocumentsIndex; summaries: ReadonlyMap<string, DocumentSummary>; changed: boolean}> {
    const next: Record<string, IndexEntry> = {}
    const summaries = new Map<string, DocumentSummary>()
    let changed = Object.keys(index).some((id) => !files.some((file) => file.id === id))

    await Promise.all(
        files.map(async (file) => {
            const known = index[file.id]

            if (known && known.size === file.size && known.savedAt === file.savedAt) {
                next[file.id] = known
                summaries.set(file.id, known.summary)
                return
            }

            const summary = await read(file.id)

            changed = true
            next[file.id] = {size: file.size, savedAt: file.savedAt, summary}
            summaries.set(file.id, summary)
        }),
    )

    return {index: next, summaries, changed}
}
