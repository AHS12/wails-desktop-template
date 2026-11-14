import {describe, expect, it} from 'vitest'
import {NOTE_FORMATS} from '../../example/note-export'
import {exportFiles, uniqueNames} from './formats'

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

describe('the files an export makes', () => {
    it('makes one file per format, named after the document', () => {
        const files = exportFiles(NOTE_FORMATS, 'Shopping', {text: 'Milk'})

        expect(files.map((file) => file.name)).toEqual(['Shopping.md', 'Shopping.txt'])
        expect(text(files[0].bytes)).toBe('# Shopping\n\nMilk\n')
        expect(text(files[1].bytes)).toBe('Milk')
    })

    it('keeps a name from reaching outside its folder', () => {
        const [file] = exportFiles(NOTE_FORMATS, '../Plans: 2026/Q1', {text: ''})

        expect(file.name).toBe('Plans 2026 Q1.md')
        expect(file.name).not.toMatch(/[\\/:]/)
    })

    it('gives a document with no usable name a plain one', () => {
        expect(exportFiles(NOTE_FORMATS, '***', {text: ''})[0].name).toBe('Export.md')
    })
})

describe('naming many documents at once', () => {
    it('never gives two the same name, whatever their case', () => {
        expect(uniqueNames(['Shopping', 'shopping', 'Ideas', 'Shopping'])).toEqual(['Shopping', 'shopping 2', 'Ideas', 'Shopping 3'])
    })
})
