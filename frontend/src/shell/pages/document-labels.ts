/**
 * What Home and the library say about a saved document: its name, its icon, and how
 * long ago it was saved, in the fewest words that are still true.
 */

import {FileText} from 'lucide-react'
import {calendarDaysBetween} from '../../core/library/document-summary'
import type {SavedDocument} from '../../platform/documents'

/** Shown where a document has no picture. */
export const DOCUMENT_ICON = FileText

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** How long ago a document was saved, in the fewest words that are still true. */
export function savedLabel(savedAt: string, now: Date = new Date()): string {
    const saved = new Date(savedAt)
    const elapsed = now.getTime() - saved.getTime()

    if (Number.isNaN(elapsed) || elapsed < MINUTE) {
        return 'just now'
    }

    const minutes = Math.floor(elapsed / MINUTE)

    if (minutes < 60) {
        return `${minutes} min ago`
    }

    const hours = Math.floor(elapsed / HOUR)

    if (hours < 24) {
        return hours === 1 ? '1 hour ago' : `${hours} hours ago`
    }

    if (calendarDaysBetween(saved, now) === 1) {
        return 'yesterday'
    }

    return new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'short'}).format(saved)
}

export function displayName(document: Pick<SavedDocument, 'name'>): string {
    const name = typeof document.name === 'string' ? document.name.trim() : ''

    return name === '' ? 'Untitled' : name
}
