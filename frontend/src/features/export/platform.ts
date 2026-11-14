/**
 * Writing an export's files, through the export service in Go. A browser has no
 * folders, so there each file is downloaded instead.
 */

import {downloadInBrowser} from '../../platform/desktop'
import {desktopApp} from '../../platform/shell'
import type {ExportFile} from './formats'

interface ExportBindings {
    WriteFiles(folder: string, files: {name: string; contents: number[]}[]): Promise<void>
    ExistingFiles(folder: string, names: string[]): Promise<string[]>
}

const bindings = () => desktopApp<ExportBindings>('export')

/** True where an export goes into a folder, rather than to the browser's downloads. */
export const writesToFolders = (): boolean => bindings() !== undefined

/** Which of these names are files in folder already. A browser never replaces one. */
export async function existingFiles(folder: string, names: readonly string[]): Promise<string[]> {
    return (await bindings()?.ExistingFiles(folder, [...names])) ?? []
}

/** Writes the files into folder, creating it if need be. */
export async function writeFiles(folder: string, files: readonly ExportFile[]): Promise<void> {
    const app = bindings()

    if (!app) {
        for (const file of files) {
            await downloadInBrowser(file.name, file.bytes, 'application/octet-stream')
        }

        return
    }

    await app.WriteFiles(
        folder,
        files.map((file) => ({name: file.name, contents: [...file.bytes]})),
    )
}
