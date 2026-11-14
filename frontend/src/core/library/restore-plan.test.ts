import {describe, expect, it} from 'vitest'
import {backupCopyName, planRestore, renamedDocument} from './restore-plan'

const ids = () => {
    let next = 0

    return () => `copy${++next}`
}

describe('restoring documents', () => {
    const held = [
        {id: 'new', name: 'Groceries', status: 'new' as const},
        {id: 'same', name: 'Ideas', status: 'same' as const},
        {id: 'shop', name: 'Shopping', status: 'different' as const},
    ]
    const text = JSON.stringify({name: 'Shopping', kind: 'note', extra: {kept: true}})

    it('brings in new documents as they are, and skips documents already here', () => {
        const choices = planRestore(held, new Set(['new', 'same']), [], () => text, ids())

        expect(choices).toEqual([{id: 'new', copyId: '', copyContents: ''}])
    })

    it('brings a document that differs in as a second copy, renamed, keeping everything else', () => {
        const [choice] = planRestore(held, new Set(['shop']), ['Shopping'], () => text, ids())
        const copy = JSON.parse(choice.copyContents)

        expect(choice.copyId).toBe('copy1')
        expect(copy).toEqual({name: 'Shopping (from backup)', kind: 'note', extra: {kept: true}})
    })

    it('leaves out documents that are not ticked', () => {
        expect(planRestore(held, new Set(), [], () => text, ids())).toEqual([])
    })

    it('never gives two copies the same name', () => {
        const twins = [
            {id: 'a', name: 'Notes', status: 'different' as const},
            {id: 'b', name: 'Notes', status: 'different' as const},
        ]
        const names = planRestore(twins, new Set(['a', 'b']), ['Notes', 'Notes (from backup)'], () => '{"name":"Notes"}', ids()).map(
            (choice) => JSON.parse(choice.copyContents).name,
        )

        expect(names).toEqual(['Notes (from backup) 2', 'Notes (from backup) 3'])
    })

    it('names a copy plainly when nothing is in the way', () => {
        expect(backupCopyName('Recipes', new Set())).toBe('Recipes (from backup)')
        expect(renamedDocument('{"name":"a","b":1}', 'c')).toBe('{\n  "name": "c",\n  "b": 1\n}\n')
    })
})
