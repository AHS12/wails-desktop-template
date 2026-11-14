import {describe, expect, it} from 'vitest'
import {groupByTime, matchesSearch, sortDocuments, summarizeDocument, timeGroupOf, UNREADABLE_NAME, type ListedDocument} from './document-summary'

const fileOf = (fields: Record<string, unknown>) =>
    JSON.stringify({
        version: 1,
        generator: 'wails-desktop-template',
        kind: 'note',
        createdAt: '2026-10-02T09:00:00.000Z',
        modifiedAt: '2026-11-01T09:00:00.000Z',
        content: {text: 'Hello'},
        ...fields,
    })

const listed = (id: string, name: string, savedAt: string, extra: Partial<ListedDocument> = {}): ListedDocument => ({
    id,
    name,
    savedAt,
    createdAt: null,
    ...extra,
})

describe('reading a saved document', () => {
    it('gives its name, kind and when it was made', () => {
        expect(summarizeDocument(fileOf({name: 'Shopping'}))).toEqual({name: 'Shopping', kind: 'note', createdAt: '2026-10-02T09:00:00.000Z'})
    })

    it('lists a file it cannot read under no kind', () => {
        for (const broken of ['not json', '[]', '{}', JSON.stringify({name: 'x'})]) {
            expect(summarizeDocument(broken)).toMatchObject({name: UNREADABLE_NAME, kind: null})
        }
    })

    it('names a document with no name', () => {
        expect(summarizeDocument(fileOf({})).name).toBe('Untitled')
    })
})

describe('sorting documents', () => {
    const documents = [
        listed('a', 'birch', '2026-11-01T10:00:00Z', {createdAt: '2026-01-01T00:00:00Z'}),
        listed('b', 'Apple', '2026-11-03T10:00:00Z', {createdAt: '2025-01-01T00:00:00Z'}),
        listed('c', 'cedar', '2026-10-01T10:00:00Z', {createdAt: '2026-06-01T00:00:00Z'}),
    ]

    it('puts the last changed first', () => {
        expect(sortDocuments(documents, 'changed').map((document) => document.id)).toEqual(['b', 'a', 'c'])
    })

    it('sorts by name ignoring case', () => {
        expect(sortDocuments(documents, 'name').map((document) => document.name)).toEqual(['Apple', 'birch', 'cedar'])
    })

    it('puts the most recently made first', () => {
        expect(sortDocuments(documents, 'made').map((document) => document.id)).toEqual(['c', 'a', 'b'])
    })
})

describe('grouping documents by when they changed', () => {
    const now = new Date(2026, 10, 4, 9, 0)

    it('counts calendar days, not hours', () => {
        expect(timeGroupOf(new Date(2026, 10, 4, 0, 5).toISOString(), now)).toBe('Today')
        expect(timeGroupOf(new Date(2026, 10, 3, 23, 55).toISOString(), now)).toBe('This week')
        expect(timeGroupOf(new Date(2026, 9, 29, 12, 0).toISOString(), now)).toBe('This week')
        expect(timeGroupOf(new Date(2026, 9, 20, 12, 0).toISOString(), now)).toBe('This month')
        expect(timeGroupOf(new Date(2026, 5, 1, 12, 0).toISOString(), now)).toBe('Earlier')
    })

    it('keeps a day across a clock change as one day', () => {
        // Clocks go back in late October in many places; one calendar day is still one.
        const morning = new Date(2026, 9, 26, 9, 0)

        expect(timeGroupOf(new Date(2026, 9, 25, 9, 0).toISOString(), morning)).toBe('This week')
    })

    it('splits a sorted list into runs under each heading', () => {
        const documents = [
            listed('a', 'a', new Date(2026, 10, 4, 8).toISOString()),
            listed('b', 'b', new Date(2026, 10, 2, 8).toISOString()),
            listed('c', 'c', new Date(2026, 10, 1, 8).toISOString()),
            listed('d', 'd', new Date(2025, 0, 1).toISOString()),
        ]

        expect(groupByTime(documents, now).map(({group, documents: inGroup}) => [group, inGroup.length])).toEqual([
            ['Today', 1],
            ['This week', 2],
            ['Earlier', 1],
        ])
    })
})

describe('searching documents', () => {
    it('matches part of a name, ignoring case', () => {
        expect(matchesSearch(listed('a', 'Weekly Shopping', ''), 'shop')).toBe(true)
        expect(matchesSearch(listed('a', 'Weekly Shopping', ''), 'garden')).toBe(false)
    })
})
