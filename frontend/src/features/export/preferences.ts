/**
 * What an export remembers between exports: the folder and the formats picked.
 *
 * Kept in the window's own storage. It's a convenience: a missing or damaged entry
 * gives the defaults, never an error.
 */

import {APP} from '../../core/app'

export interface ExportPreferences {
    /** The folder last exported to, or empty until there is one. */
    readonly folder: string
    /** The formats last picked, by id. */
    readonly formats: readonly string[]
}

const KEY = `${APP.id}.export`

export function loadExportPreferences(known: readonly string[]): ExportPreferences {
    const fallback = {folder: '', formats: known.slice(0, 1)}

    try {
        const stored = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<ExportPreferences> | null
        const formats = Array.isArray(stored?.formats) ? stored.formats.filter((id): id is string => typeof id === 'string' && known.includes(id)) : []

        return {
            folder: typeof stored?.folder === 'string' ? stored.folder : '',
            formats: formats.length > 0 ? formats : fallback.formats,
        }
    } catch {
        return fallback
    }
}

export function saveExportPreferences(preferences: ExportPreferences): void {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(preferences))
    } catch {
        // Only a convenience is lost: the next export asks again.
    }
}
