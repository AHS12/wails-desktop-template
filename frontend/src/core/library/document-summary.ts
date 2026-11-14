/**
 * What the library page knows about a saved document without opening it.
 *
 * Reading is shallow and forgiving: a folder with one broken file still lists the rest,
 * and the broken one is listed too. Only the envelope is read, never the content, so
 * this works for every type of document.
 */

export interface DocumentSummary {
    readonly name: string
    /** The file's `kind`, or null for a file that can't be read. */
    readonly kind: string | null
    /** ISO timestamp from the file, or null when it doesn't say. */
    readonly createdAt: string | null
}

export const UNREADABLE_NAME = 'Unreadable document'

const UNREADABLE: DocumentSummary = {name: UNREADABLE_NAME, kind: null, createdAt: null}

const textOf = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null)

export function summarizeDocument(contents: string): DocumentSummary {
    let parsed: unknown

    try {
        parsed = JSON.parse(contents)
    } catch {
        return UNREADABLE
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return UNREADABLE
    }

    const file = parsed as Record<string, unknown>
    const kind = textOf(file.kind)

    if (!kind) {
        return UNREADABLE
    }

    return {
        name: textOf(file.name)?.trim() ?? 'Untitled',
        kind,
        createdAt: textOf(file.createdAt),
    }
}

export type DocumentSort = 'changed' | 'name' | 'made'

/** The fields sorting, grouping and search need. */
export interface ListedDocument {
    readonly id: string
    readonly name: string
    readonly savedAt: string
    readonly createdAt: string | null
}

const collator = new Intl.Collator(undefined, {sensitivity: 'base', numeric: true})

const timeOf = (iso: string | null): number => {
    const time = iso ? Date.parse(iso) : Number.NaN

    return Number.isNaN(time) ? 0 : time
}

/** Newest first for both dates, so the document you touched last leads. Ties go by name. */
export function sortDocuments<T extends ListedDocument>(documents: readonly T[], sort: DocumentSort): T[] {
    const byName = (left: T, right: T) => collator.compare(left.name, right.name) || left.id.localeCompare(right.id)

    return [...documents].sort((left, right) => {
        switch (sort) {
            case 'name':
                return byName(left, right)
            case 'made':
                return timeOf(right.createdAt ?? right.savedAt) - timeOf(left.createdAt ?? left.savedAt) || byName(left, right)
            default:
                return timeOf(right.savedAt) - timeOf(left.savedAt) || byName(left, right)
        }
    })
}

export type TimeGroup = 'Today' | 'This week' | 'This month' | 'Earlier'

const DAY = 24 * 60 * 60 * 1000

/** Whole calendar days between two moments, so a clock change is still one day. */
export function calendarDaysBetween(from: Date, to: Date): number {
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate())

    return Math.round((end.getTime() - start.getTime()) / DAY)
}

export function timeGroupOf(savedAt: string, now: Date): TimeGroup {
    const days = calendarDaysBetween(new Date(timeOf(savedAt)), now)

    if (days <= 0) {
        return 'Today'
    }

    if (days < 7) {
        return 'This week'
    }

    return days < 31 ? 'This month' : 'Earlier'
}

/** Documents already sorted by Last changed, split into runs under a heading each. */
export function groupByTime<T extends ListedDocument>(documents: readonly T[], now: Date): {group: TimeGroup; documents: T[]}[] {
    const groups: {group: TimeGroup; documents: T[]}[] = []

    for (const document of documents) {
        const group = timeGroupOf(document.savedAt, now)
        const last = groups.at(-1)

        if (last?.group === group) {
            last.documents.push(document)
        } else {
            groups.push({group, documents: [document]})
        }
    }

    return groups
}

/** Part of the name, ignoring case. */
export function matchesSearch(document: ListedDocument, needle: string): boolean {
    const wanted = needle.trim().toLowerCase()

    return wanted === '' || document.name.toLowerCase().includes(wanted)
}
