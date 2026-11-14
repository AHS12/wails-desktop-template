/**
 * Where settings are kept: a file written by Go, so they survive a WebView reset.
 *
 * A copy goes in the browser's storage as well, which is the only place in a plain
 * browser, and lets the first paint use the right theme and scale before Go answers.
 */

import {APP} from '../core/app'
import {textFromBinding} from './bytes'
import {desktopApp} from './shell'

interface SettingsBindings {
    ReadSettings(): Promise<unknown>
    WriteSettings(contents: number[]): Promise<void>
}

interface LibraryFolderBindings {
    SetLibraryFolder(folder: string): Promise<void>
    GetLibraryInfo(): Promise<LibraryInfo>
    OpenLibraryFolder(): Promise<void>
}

export interface LibraryInfo {
    readonly folder: string
    readonly documents: number
    readonly bytes: number
}

const BROWSER_KEY = `${APP.id}.settings`

const bindings = () =>
    desktopApp<SettingsBindings>()

export function readSettingsCopy(): string | null {
    try {
        return window.localStorage.getItem(BROWSER_KEY)
    } catch {
        return null
    }
}

/** The file's text, or null when there is none or it cannot be read. */
export async function readSettingsFile(): Promise<string | null> {
    const app = bindings()

    if (!app) {
        return null
    }

    try {
        const text = textFromBinding(await app.ReadSettings())

        return text === '' ? null : text
    } catch {
        return null
    }
}

export async function writeSettingsFile(text: string): Promise<void> {
    try {
        window.localStorage.setItem(BROWSER_KEY, text)
    } catch {
        // The file below is the real copy.
    }

    await bindings()?.WriteSettings([...new TextEncoder().encode(text)])
}

export const hasDesktopStorage = () => bindings() !== undefined

const library = () => desktopApp<LibraryFolderBindings>('documents')

export const libraryInfo = async () => (await library()?.GetLibraryInfo()) ?? null

export const openLibraryFolder = async () => library()?.OpenLibraryFolder()

export const setLibraryFolder = async (folder: string) => library()?.SetLibraryFolder(folder)
