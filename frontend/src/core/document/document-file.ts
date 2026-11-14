/**
 * The document file.
 *
 * A versioned JSON envelope around whatever an app's documents hold. The envelope is the
 * same for every app: name, when it was made and changed, which app wrote it, and the
 * version of its content. The content belongs to a `DocumentType`, which validates it.
 *
 * Loading checks the whole file before anything touches the session, so a bad file is a
 * message, not a half-loaded document. Keys this build doesn't know are kept and written
 * back, so opening a file in an older build doesn't quietly delete what a newer one added.
 */

import {z} from 'zod'
import {APP} from '../app'

/** What an app's documents hold, and how to read old versions of it. */
export interface DocumentType<T> {
    /** Written as `kind`, so one app can have more than one type of document. */
    readonly kind: string
    /** What a person calls one, in lower case: "note". */
    readonly noun: string
    /** The version of `content`. Raise it when the shape changes, and add a migration. */
    readonly version: number
    /** Checks the content. A failure names the first thing wrong. */
    readonly content: z.ZodType<T>
    /** A new, empty document's content. */
    empty(): T
    /** Each entry turns a file's content at version `n` into version `n + 1`. */
    readonly migrations?: Readonly<Record<number, (content: unknown) => unknown>>
}

/** What loading a document gives back. */
export interface LoadedDocument<T> {
    readonly name: string
    readonly content: T
    /** Keys this build doesn't know about, plus `createdAt`, to write back on save. */
    readonly extras: Readonly<Record<string, unknown>>
}

export class DocumentFileError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'DocumentFileError'
    }
}

const envelopeSchema = z.looseObject({
    version: z.number().int().min(1),
    generator: z.literal(APP.id),
    kind: z.string().min(1),
    createdAt: z.string().min(1),
    modifiedAt: z.string().min(1),
    name: z.string().min(1).optional(),
    content: z.unknown(),
})

const KNOWN_KEYS = new Set(['version', 'generator', 'kind', 'createdAt', 'modifiedAt', 'name', 'content'])

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function describeIssue(issue: z.core.$ZodIssue): string {
    const path = issue.path.map(String).join('.')

    return path ? `${path}: ${issue.message}` : issue.message
}

/** The name a document gets when it has none: "Untitled note". */
export const untitled = (type: DocumentType<unknown>): string => `Untitled ${type.noun}`

/**
 * Reads a document file.
 *
 * Throws `DocumentFileError` with a message meant for the user. Nothing outside this
 * function changes, so a failed load leaves the session as it was.
 */
export function parseDocument<T>(text: string, type: DocumentType<T>): LoadedDocument<T> {
    const article = `a ${APP.name} ${type.noun}`
    let raw: unknown

    try {
        raw = JSON.parse(text)
    } catch {
        throw new DocumentFileError(`This file isn't ${article}. It isn't valid JSON.`)
    }

    if (!isObject(raw) || raw.generator !== APP.id) {
        throw new DocumentFileError(`This file isn't ${article}.`)
    }

    const envelope = envelopeSchema.safeParse(raw)

    if (!envelope.success) {
        throw new DocumentFileError(`This file isn't a valid ${type.noun}. ${describeIssue(envelope.error.issues[0])}`)
    }

    const file = envelope.data

    if (file.kind !== type.kind) {
        throw new DocumentFileError(`This file is a ${file.kind}, not a ${type.noun}.`)
    }

    if (file.version > type.version) {
        throw new DocumentFileError(`This ${type.noun} was made by a newer version of ${APP.name}. Update the app to open it.`)
    }

    let content = file.content

    for (let from = file.version; from < type.version; from++) {
        const step = type.migrations?.[from]

        if (!step) {
            throw new DocumentFileError(`This ${type.noun} is from version ${from}, which this build can't read.`)
        }

        content = step(content)
    }

    const checked = type.content.safeParse(content)

    if (!checked.success) {
        throw new DocumentFileError(`This file isn't a valid ${type.noun}. ${describeIssue(checked.error.issues[0])}`)
    }

    const extras: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(file)) {
        if (!KNOWN_KEYS.has(key)) {
            extras[key] = value
        }
    }

    // Carried with the extras, so saving again keeps when it was first made.
    extras.createdAt = file.createdAt

    return {name: file.name?.trim() || untitled(type), content: checked.data, extras}
}

export interface SaveInput<T> {
    readonly name: string
    readonly content: T
    readonly extras?: Readonly<Record<string, unknown>>
    /** Overridable so tests don't depend on the clock. */
    readonly now?: Date
}

/** The document file's text, ready to write. */
export function serializeDocument<T>(input: SaveInput<T>, type: DocumentType<T>): string {
    const now = (input.now ?? new Date()).toISOString()
    const extras = input.extras ?? {}
    const created = typeof extras.createdAt === 'string' ? extras.createdAt : now

    const file = {
        // Unknown keys first, so anything this build knows wins.
        ...extras,
        version: type.version,
        generator: APP.id,
        kind: type.kind,
        createdAt: created,
        modifiedAt: now,
        name: input.name,
        content: input.content,
    }

    return `${JSON.stringify(file, null, 2)}\n`
}
