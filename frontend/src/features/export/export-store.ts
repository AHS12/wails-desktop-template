/**
 * Exporting: which dialog is open, the formats the app offers, and an export of many
 * documents while it runs.
 */

import {create} from 'zustand'
import {parseDocument} from '../../core/document/document-file'
import {yieldIfBusy} from '../../core/yield'
import {readDocument} from '../../platform/documents'
import {documentType, type Content} from '../../store/document-store'
import {exportFiles, uniqueNames, type ExportFile, type ExportFormat} from './formats'
import {existingFiles, writeFiles} from './platform'

/** How far an export of many has got. It has `finished` once it has. */
export interface ExportRun {
    readonly done: number
    readonly total: number
    /** The document being exported now. */
    readonly current: string | null
    /** Names of the documents that couldn't be read or written. */
    readonly failed: readonly string[]
    readonly folder: string
    readonly finished: boolean
    readonly stopped: boolean
}

interface ExportStore {
    /** What the app can export to, from the feature. */
    formats: readonly ExportFormat<Content>[]

    dialog: 'one' | 'many' | null
    /** The documents an export of many starts with ticked. */
    picked: readonly string[]
    openOne(): void
    openMany(picked?: readonly string[]): void
    close(): void

    run: ExportRun | null
    /** Exports each document, as the formats picked, into folder. */
    exportMany(documents: readonly {id: string; name: string}[], formats: readonly string[], folder: string): Promise<void>
    stop(): void
    clearRun(): void
}

/** Set by Stop, and read between documents. Not state: nothing draws it. */
let stopping = false

export const useExportStore = create<ExportStore>((set, get) => ({
    formats: [],

    dialog: null,
    picked: [],
    openOne: () => set({dialog: 'one'}),
    openMany: (picked = []) => set({dialog: 'many', picked}),
    close: () => set({dialog: null}),

    run: null,

    exportMany: async (documents, formatIds, folder) => {
        const formats = get().formats.filter((format) => formatIds.includes(format.id))
        const names = uniqueNames(documents.map((document) => document.name))
        const failed: string[] = []
        let done = 0

        stopping = false
        set({run: {done, total: documents.length, current: null, failed, folder, finished: false, stopped: false}})

        for (const [index, document] of documents.entries()) {
            if (stopping) {
                break
            }

            set({run: {done, total: documents.length, current: document.name, failed, folder, finished: false, stopped: false}})

            // Lets the progress draw before a long run of documents blocks the page.
            await yieldIfBusy()

            try {
                const loaded = parseDocument(await readDocument(document.id), documentType)
                const files: ExportFile[] = exportFiles(formats, names[index], loaded.content)

                await writeFiles(folder, files)
            } catch {
                failed.push(document.name)
            }

            done += 1
        }

        set({run: {done, total: documents.length, current: null, failed, folder, finished: true, stopped: stopping}})
    },

    stop: () => {
        stopping = true
    },

    clearRun: () => set({run: null}),
}))

/** The files an export of these documents would write that are in folder already. */
export async function filesAlreadyThere(documents: readonly {name: string}[], formatIds: readonly string[], folder: string): Promise<string[]> {
    const formats = useExportStore.getState().formats.filter((format) => formatIds.includes(format.id))
    const names = uniqueNames(documents.map((document) => document.name)).flatMap((name) => formats.map((format) => `${name}.${format.extension}`))

    return existingFiles(folder, names)
}
