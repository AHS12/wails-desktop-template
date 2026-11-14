import {describe, expect, it} from 'vitest'
import {z} from 'zod'
import {APP} from '../app'
import {DocumentFileError, parseDocument, serializeDocument, type DocumentType} from './document-file'

interface Card {
    readonly title: string
    readonly done: boolean
}

const cardType: DocumentType<Card> = {
    kind: 'card',
    noun: 'card',
    version: 2,
    content: z.object({title: z.string(), done: z.boolean()}),
    empty: () => ({title: '', done: false}),
    // Version 1 had no done flag.
    migrations: {1: (content) => ({done: false, ...(content as object)})},
}

const fileOf = (fields: Record<string, unknown>) =>
    JSON.stringify({
        version: 2,
        generator: APP.id,
        kind: 'card',
        createdAt: '2026-01-01T00:00:00.000Z',
        modifiedAt: '2026-01-02T00:00:00.000Z',
        name: 'Shopping',
        content: {title: 'Milk', done: true},
        ...fields,
    })

describe('the document file', () => {
    it('gives back the name and content it was saved with', () => {
        const text = serializeDocument({name: 'Shopping', content: {title: 'Milk', done: true}}, cardType)
        const loaded = parseDocument(text, cardType)

        expect(loaded.name).toBe('Shopping')
        expect(loaded.content).toEqual({title: 'Milk', done: true})
    })

    it('records when it was saved, and keeps when it was first made', () => {
        const first = serializeDocument({name: 'A', content: cardType.empty(), now: new Date('2026-01-01T00:00:00Z')}, cardType)
        const opened = parseDocument(first, cardType)
        const again = JSON.parse(serializeDocument({...opened, now: new Date('2026-03-01T00:00:00Z')}, cardType))

        expect(again.createdAt).toBe('2026-01-01T00:00:00.000Z')
        expect(again.modifiedAt).toBe('2026-03-01T00:00:00.000Z')
    })

    it('writes back keys it does not understand', () => {
        const opened = parseDocument(fileOf({colour: 'red'}), cardType)
        const saved = JSON.parse(serializeDocument(opened, cardType))

        expect(saved.colour).toBe('red')
    })

    it('upgrades content from an older version', () => {
        const loaded = parseDocument(fileOf({version: 1, content: {title: 'Old'}}), cardType)

        expect(loaded.content).toEqual({title: 'Old', done: false})
    })

    it('refuses a file from a newer version of the app', () => {
        expect(() => parseDocument(fileOf({version: 3}), cardType)).toThrow(/newer version/)
    })

    it('refuses a file another app wrote', () => {
        expect(() => parseDocument(fileOf({generator: 'some-other-app'}), cardType)).toThrow(DocumentFileError)
    })

    it('refuses a file that is not JSON', () => {
        expect(() => parseDocument('not json', cardType)).toThrow(/isn't valid JSON/)
    })

    it('refuses another type of document, and says which it is', () => {
        expect(() => parseDocument(fileOf({kind: 'list'}), cardType)).toThrow(/is a list, not a card/)
    })

    it('names the part of the content that is wrong', () => {
        expect(() => parseDocument(fileOf({content: {title: 'Milk', done: 'yes'}}), cardType)).toThrow(/done/)
    })

    it('gives a document with no name a plain one', () => {
        expect(parseDocument(fileOf({name: undefined}), cardType).name).toBe('Untitled card')
    })
})
