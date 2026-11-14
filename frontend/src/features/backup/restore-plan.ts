/**
 * Deciding what a restore does, before anything moves.
 *
 * A restore never replaces anything: a document that differs from the one saved
 * here comes in as a second copy, named so you can tell them apart.
 */

/**
 * How a document in a backup compares with the saved document of the same id. A cloud
 * backup adds "removed", for a document a computer removed since it was backed up.
 */
export type HeldStatus = 'new' | 'same' | 'different' | 'removed'

export interface HeldToRestore {
    readonly id: string
    readonly name: string
    readonly status: HeldStatus
}

/** What Go needs to bring one document in. */
export interface RestoreChoice {
    readonly id: string
    /** Set when the document comes in beside the saved one, as a second copy. */
    readonly copyId: string
    readonly copyContents: string
}

export const FROM_BACKUP = '(from backup)'

/** "Shopping (from backup)", or "Shopping (from backup) 2" when that's taken. */
export function backupCopyName(name: string, taken: ReadonlySet<string>): string {
    const base = `${name} ${FROM_BACKUP}`

    if (!taken.has(base)) {
        return base
    }

    let count = 2

    while (taken.has(`${base} ${count}`)) {
        count += 1
    }

    return `${base} ${count}`
}

/** The document file's text with a new name, every other key kept as it was. */
export function renamedDocument(text: string, name: string): string {
    const document = JSON.parse(text) as Record<string, unknown>

    return `${JSON.stringify({...document, name}, null, 2)}\n`
}

/**
 * What to restore for the ticked documents. Documents already here, byte for byte, are
 * left out whatever the ticks say. One that differs comes in under a new id and
 * a name of its own, read from `textOf`.
 */
export function planRestore(
    held: readonly HeldToRestore[],
    ticked: ReadonlySet<string>,
    savedNames: readonly string[],
    textOf: (id: string) => string,
    newId: () => string,
): RestoreChoice[] {
    const taken = new Set(savedNames)

    return held
        .filter((held) => ticked.has(held.id) && held.status !== 'same')
        .map((held) => {
            if (held.status === 'new' || held.status === 'removed') {
                return {id: held.id, copyId: '', copyContents: ''}
            }

            const name = backupCopyName(held.name, taken)

            taken.add(name)

            return {id: held.id, copyId: newId(), copyContents: renamedDocument(textOf(held.id), name)}
        })
}
