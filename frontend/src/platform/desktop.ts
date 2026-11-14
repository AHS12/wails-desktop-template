/**
 * The desktop boundary, from the frontend's side.
 *
 * In the app it calls Go through the bindings Wails injects. In a browser —
 * `pnpm dev`, or a test — it falls back to the file input and download the
 * web platform offers, so nothing here is app-only.
 *
 * Nothing in this module parses a file. It moves text and bytes and turns
 * failures into plain sentences.
 */

import {textFromBinding} from './bytes'
import {desktopApp} from './shell'

const DOCUMENT_FILTERS = ['*.json']
const BROWSER_DOWNLOADS = 'Downloads'

interface WailsApp {
    OpenFileDialog(title: string, filters: string[]): Promise<string>
    SaveFileDialog(title: string, defaultName: string, filters: string[]): Promise<string>
    ReadFile(path: string): Promise<number[]>
    WriteFile(path: string, contents: number[]): Promise<void>
    ChooseFolder(title: string, start: string): Promise<string>
    ShowFolder(folder: string): Promise<void>
}



function desktop(): WailsApp | undefined {
    return desktopApp<WailsApp>()
}

/** True when the app is running inside the desktop shell. */
export function isDesktop(): boolean {
    return desktop() !== undefined
}

/** Saves bytes as a download, which is all a browser can do with a file. */
export async function downloadInBrowser(name: string, bytes: Uint8Array, type: string): Promise<void> {
    const blob = new Blob([new Uint8Array(bytes)], {type})
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    URL.revokeObjectURL(url)
}

/** Asks for a document file and returns its path and contents, or null. */
export async function openDocumentFile(title: string): Promise<{path: string; text: string} | null> {
    const app = desktop()

    if (!app) {
        return openWithBrowser()
    }

    const path = await app.OpenFileDialog(title, DOCUMENT_FILTERS)

    if (!path) {
        return null
    }

    const bytes = await app.ReadFile(path)

    return {path, text: textFromBinding(bytes)}
}

/** Asks where to save, then writes. Returns the path, or null if cancelled. */
export async function saveDocumentFile(text: string, path: string | null, suggestedName: string, title: string): Promise<string | null> {
    const app = desktop()

    if (!app) {
        await downloadInBrowser(suggestedName, new TextEncoder().encode(text), 'application/json')
        return suggestedName
    }

    const target = path ?? (await app.SaveFileDialog(title, suggestedName, DOCUMENT_FILTERS))

    if (!target) {
        return null
    }

    await app.WriteFile(target, [...new TextEncoder().encode(text)])

    return target
}

/** Asks where to save a picture, then writes it. Returns the path, or null if cancelled. */
export async function savePictureFile(bytes: Uint8Array, suggestedName: string): Promise<string | null> {
    const app = desktop()

    if (!app) {
        await downloadInBrowser(suggestedName, bytes, 'image/png')
        return suggestedName
    }

    const target = await app.SaveFileDialog('Save a picture', suggestedName, ['*.png'])

    if (!target) {
        return null
    }

    await app.WriteFile(target, [...bytes])

    return target
}

/**
 * Asks for a folder and returns it, or null if cancelled. A browser has no
 * folders to offer, so it answers with where downloads go.
 */
export async function chooseFolder(start: string, title = 'Choose a folder'): Promise<string | null> {
    const app = desktop()

    if (!app) {
        return BROWSER_DOWNLOADS
    }

    return (await app.ChooseFolder(title, start)) || null
}

/** Opens a folder in the file manager. A browser has none, so it does nothing. */
export async function showFolder(folder: string): Promise<void> {
    await desktop()?.ShowFolder(folder)
}

function openWithBrowser(): Promise<{path: string; text: string} | null> {
    return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json,application/json'
        input.addEventListener('change', async () => {
            const file = input.files?.[0]

            if (!file) {
                resolve(null)
                return
            }

            resolve({path: file.name, text: await file.text()})
        })
        input.addEventListener('cancel', () => resolve(null))
        input.click()
    })
}
