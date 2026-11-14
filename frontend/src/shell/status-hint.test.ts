import {describe, expect, it} from 'vitest'
import {hintFor} from './status-hint'

describe('the status hint', () => {
    it('names the keys for saving and for finding a command', () => {
        expect(hintFor({save: 'Ctrl+S', palette: 'Ctrl+K'})).toBe('Ctrl+S to save · Ctrl+K to find any command')
    })

    it('leaves out a command that has no keys', () => {
        expect(hintFor({palette: 'Ctrl+K'})).toBe('Ctrl+K to find any command')
        expect(hintFor({})).toBe('')
    })
})
