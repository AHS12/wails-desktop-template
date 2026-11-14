import {describe, expect, it} from 'vitest'
import {canRedo, canUndo, EMPTY_HISTORY, pushHistory, redo, redoLabel, undo, undoLabel} from '../core/history/history'

const state = (text: string) => ({text})

describe('history', () => {
    it('starts with nothing to undo or redo', () => {
        expect(canUndo(EMPTY_HISTORY)).toBe(false)
        expect(canRedo(EMPTY_HISTORY)).toBe(false)
        expect(undoLabel(EMPTY_HISTORY)).toBeNull()
        expect(redoLabel(EMPTY_HISTORY)).toBeNull()
    })

    it('undoes and redoes a change', () => {
        const before = state('one')
        const after = state('two')

        const history = pushHistory(EMPTY_HISTORY, 'type', before, after)
        expect(canUndo(history)).toBe(true)

        const undone = undo(history)
        expect(undone?.document).toBe(before)
        expect(undone?.history.index).toBe(-1)

        const redone = redo(undone!.history)
        expect(redone?.document).toBe(after)
    })

    it('names the operation it would reverse', () => {
        const history = pushHistory(EMPTY_HISTORY, 'type', state('one'), state('two'))

        expect(undoLabel(history)).toBe('type')
        expect(redoLabel(history)).toBeNull()
    })

    it('drops the redo entries when a new edit is made', () => {
        const first = pushHistory(EMPTY_HISTORY, 'first', state('one'), state('two'))
        const undone = undo(first)!

        const second = pushHistory(undone.history, 'second', undone.document, state('three'))

        expect(canRedo(second)).toBe(false)
        expect(second.entries).toHaveLength(1)
    })

    it('keeps only the most recent two hundred steps', () => {
        let history = pushHistory(EMPTY_HISTORY, 'step 0', state('0'), state('1'))

        for (let step = 1; step < 250; step++) {
            history = pushHistory(history, `step ${step}`, state(String(step)), state(String(step + 1)))
        }

        expect(history.entries).toHaveLength(200)
        expect(undoLabel(history)).toBe('step 249')
    })

    it('does not mutate the states it is given', () => {
        const before = state('one')
        const after = state('two')
        const snapshot = {...before}

        pushHistory(EMPTY_HISTORY, 'type', before, after)

        expect(before).toEqual(snapshot)
    })
})
