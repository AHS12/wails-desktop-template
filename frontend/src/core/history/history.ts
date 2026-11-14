/**
 * Undo and redo.
 *
 * A history of whole document snapshots. Documents are immutable values, so a
 * snapshot is only a reference, and storing one per step costs almost nothing.
 */

export interface HistoryEntry<T> {
    readonly label: string
    readonly before: T
    readonly after: T
}

export interface History<T = unknown> {
    readonly entries: readonly HistoryEntry<T>[]
    /** Index of the last applied entry. -1 means nothing has been applied. */
    readonly index: number
}

export const EMPTY_HISTORY: History<never> = {entries: [], index: -1}

/** How many steps are kept. */
const MAX_DEPTH = 200

/**
 * Records an edit.
 *
 * Any redo entries are dropped, because the user has changed the document
 * since they were made.
 */
export function pushHistory<T>(history: History<T>, label: string, before: T, after: T): History<T> {
    const kept =
        history.index < history.entries.length - 1
            ? history.entries.slice(0, history.index + 1)
            : history.entries

    const entries = [...kept, {label, before, after}].slice(-MAX_DEPTH)

    return {entries, index: entries.length - 1}
}

export function canUndo(history: History): boolean {
    return history.index >= 0
}

export function canRedo(history: History): boolean {
    return history.index < history.entries.length - 1
}

/** The name of the operation that undo would reverse. */
export function undoLabel(history: History): string | null {
    return canUndo(history) ? history.entries[history.index].label : null
}

/** The name of the operation that redo would repeat. */
export function redoLabel(history: History): string | null {
    return canRedo(history) ? history.entries[history.index + 1].label : null
}

export function undo<T>(history: History<T>): {history: History<T>; document: T} | null {
    if (!canUndo(history)) {
        return null
    }

    const entry = history.entries[history.index]

    return {
        history: {...history, index: history.index - 1},
        document: entry.before,
    }
}

export function redo<T>(history: History<T>): {history: History<T>; document: T} | null {
    if (!canRedo(history)) {
        return null
    }

    const entry = history.entries[history.index + 1]

    return {
        history: {...history, index: history.index + 1},
        document: entry.after,
    }
}
