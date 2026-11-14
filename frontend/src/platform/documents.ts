/**
 * The library's files, from the frontend's side.
 *
 * A saved document is one JSON file in a folder the app owns, with an optional PNG
 * beside it. Go lists and moves the files; this module turns that into something a page
 * can draw.
 *
 * Pictures aren't read here at all. Go serves them at an address of their own, so a page
 * only loads the ones on screen. What each file holds comes from the index of saved
 * documents, and only files that changed since are read again.
 */

import {bytesOfDataUrl} from '../core/files'
import {summarizeDocument, type DocumentSummary} from '../core/library/document-summary'
import {parseDocumentsIndex, refreshDocumentsIndex, serializeDocumentsIndex} from '../core/library/documents-index'
import {textFromBinding} from './bytes'
import {desktopApp} from './shell'

const BINDINGS = (): LibraryBindings | undefined =>
    desktopApp<LibraryBindings>('documents')

interface DocumentFile {
    id: string
    savedAt: string
    size: number
    hasPicture: boolean
}

interface LibraryBindings {
    ListDocuments(): Promise<DocumentFile[] | null>
    ReadDocument(id: string): Promise<unknown>
    WriteDocument(id: string, contents: number[], thumbnail: number[]): Promise<void>
    WriteDocumentPicture(id: string, picture: number[]): Promise<void>
    DeleteDocument(id: string): Promise<void>
    ShowDocument(id: string): Promise<void>
    ReadDocumentsIndex(): Promise<unknown>
    WriteDocumentsIndex(contents: number[]): Promise<void>
    RemoveDocument(id: string): Promise<void>
    PutBackDocument(id: string): Promise<void>
    ForgetRemovedDocument(id: string): Promise<void>
    ForgetOldRemovedDocuments(): Promise<void>
    ListRemovedDocuments(): Promise<RemovedFile[] | null>
    ReadRemovedDocument(id: string): Promise<unknown>
    CopyDocumentPicture(from: string, to: string): Promise<void>
}

interface RemovedFile {
    id: string
    savedAt: string
    removedAt: string
    size: number
    hasPicture: boolean
}

/** One saved document as the pages show it. */
export interface SavedDocument extends DocumentSummary {
    readonly id: string
    /** ISO timestamp of the last save. */
    readonly savedAt: string
    /** Bytes on disk. */
    readonly size: number
    /** Where its picture is served, or null when it has none yet. */
    readonly thumbnail: string | null
}

/** A document in Recently removed, waiting to be put back or forgotten. */
export interface RemovedDocument extends SavedDocument {
    /** ISO timestamp of when it was removed. */
    readonly removedAt: string
}

export class LibraryUnavailableError extends Error {
    constructor() {
        super('Saved documents are only available in the app.')
        this.name = 'LibraryUnavailableError'
    }
}

export function isLibraryAvailable(): boolean {
    return BINDINGS() !== undefined
}

/** The address Go serves a document's picture at. The time saved keeps an old copy from showing. */
export const pictureAddress = (id: string, savedAt: string): string =>
    `/documents/${encodeURIComponent(id)}.png?v=${encodeURIComponent(savedAt)}`

async function readIndex(bindings: LibraryBindings): Promise<string | null> {
    try {
        return textFromBinding(await bindings.ReadDocumentsIndex())
    } catch {
        return null
    }
}

/** Every saved document, newest first. */
export async function listDocuments(): Promise<SavedDocument[]> {
    const bindings = BINDINGS()

    if (!bindings) {
        return []
    }

    const [files, indexText] = await Promise.all([bindings.ListDocuments().then((list) => list ?? []), readIndex(bindings)])

    const {index, summaries, changed} = await refreshDocumentsIndex(parseDocumentsIndex(indexText), files, async (id) =>
        summarizeDocument(textFromBinding(await bindings.ReadDocument(id))),
    )

    if (changed) {
        // Losing the index only costs reading the files again next time.
        void bindings.WriteDocumentsIndex([...new TextEncoder().encode(serializeDocumentsIndex(index))]).catch(() => undefined)
    }

    return files.map((file) => ({
        ...(summaries.get(file.id) as DocumentSummary),
        id: file.id,
        savedAt: file.savedAt,
        size: file.size,
        thumbnail: file.hasPicture ? pictureAddress(file.id, file.savedAt) : null,
    }))
}

/** The documents in Recently removed, most recently removed first. */
export async function listRemovedDocuments(): Promise<RemovedDocument[]> {
    const bindings = BINDINGS()

    if (!bindings) {
        return []
    }

    const files = (await bindings.ListRemovedDocuments()) ?? []

    // Recently removed is small and seldom opened, so it's read whole, without an index.
    return Promise.all(
        files.map(async (file) => ({
            ...summarizeDocument(await bindings.ReadRemovedDocument(file.id).then(textFromBinding, () => '')),
            id: file.id,
            savedAt: file.savedAt,
            removedAt: file.removedAt,
            size: file.size,
            thumbnail: file.hasPicture ? removedPictureAddress(file.id, file.removedAt) : null,
        })),
    )
}

const removedPictureAddress = (id: string, removedAt: string): string =>
    `/documents/removed/${encodeURIComponent(id)}.png?v=${encodeURIComponent(removedAt)}`

function libraryBindings(): LibraryBindings {
    const bindings = BINDINGS()

    if (!bindings) {
        throw new LibraryUnavailableError()
    }

    return bindings
}

/** Moves a document and its picture to Recently removed, where it can be put back. */
export const removeDocument = (id: string): Promise<void> => libraryBindings().RemoveDocument(id)

export const putBackDocument = (id: string): Promise<void> => libraryBindings().PutBackDocument(id)

export const forgetRemovedDocument = (id: string): Promise<void> => libraryBindings().ForgetRemovedDocument(id)

/** Forgets documents removed more than 30 days ago. Nothing to do in a browser. */
export async function forgetOldRemovedDocuments(): Promise<void> {
    await BINDINGS()?.ForgetOldRemovedDocuments()
}

export const copyDocumentPicture = (from: string, to: string): Promise<void> => libraryBindings().CopyDocumentPicture(from, to)

/** A document's file text, ready for `parseDocument`. */
export async function readDocument(id: string): Promise<string> {
    const bindings = BINDINGS()

    if (!bindings) {
        throw new LibraryUnavailableError()
    }

    return textFromBinding(await bindings.ReadDocument(id))
}

/** Writes a document, and its picture when it has one. */
export async function writeDocument(
    id: string,
    text: string,
    thumbnail: string | null,
): Promise<void> {
    const bindings = BINDINGS()

    if (!bindings) {
        throw new LibraryUnavailableError()
    }

    await bindings.WriteDocument(
        id,
        [...new TextEncoder().encode(text)],
        thumbnail ? [...bytesOfDataUrl(thumbnail)] : [],
    )
}

/** Writes only a document's picture, so it keeps its place in Last changed. */
export async function writeDocumentPicture(id: string, picture: string): Promise<void> {
    const bindings = BINDINGS()

    if (!bindings) {
        throw new LibraryUnavailableError()
    }

    await bindings.WriteDocumentPicture(id, [...bytesOfDataUrl(picture)])
}

/** Shows the document's file in the system's file manager. */
export async function showDocumentFile(id: string): Promise<void> {
    const bindings = BINDINGS()

    if (!bindings) {
        throw new LibraryUnavailableError()
    }

    await bindings.ShowDocument(id)
}

export async function deleteDocument(id: string): Promise<void> {
    const bindings = BINDINGS()

    if (!bindings) {
        throw new LibraryUnavailableError()
    }

    await bindings.DeleteDocument(id)
}

/** An id the library accepts: a file stem, safe on every platform. */
export function newDocumentId(): string {
    const stamp = Date.now().toString(36)
    const salt = Math.random().toString(36).slice(2, 6)

    return `d${stamp}${salt}`
}
