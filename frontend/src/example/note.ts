/**
 * The example app's one type of document: a note.
 *
 * This file and the rest of `example/` are the part a new app replaces.
 */

import {z} from 'zod'
import type {DocumentType} from '../core/document/document-file'

export interface Note {
    readonly text: string
}

export const noteType: DocumentType<Note> = {
    kind: 'note',
    noun: 'note',
    version: 1,
    content: z.object({text: z.string()}),
    empty: () => ({text: ''}),
}

/** The first line of a note, for the library and the window's title. */
export function firstLine(note: Note): string {
    return note.text.split('\n').find((line) => line.trim() !== '')?.trim() ?? ''
}
