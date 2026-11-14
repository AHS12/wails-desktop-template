import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {EMPTY_HISTORY} from '../core/history/history'
import {useDocumentStore} from '../store/document-store'
import {NoteEditor} from './NoteEditor'

beforeEach(() => {
    vi.useFakeTimers()
    const empty = {text: ''}

    useDocumentStore.setState({content: empty, savedContent: empty, history: EMPTY_HISTORY})
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
})

const type = (text: string) => fireEvent.change(screen.getByRole('textbox', {name: 'Note'}), {target: {value: text}})

describe('the note editor', () => {
    it('makes a burst of typing one step to undo, once it pauses', () => {
        render(<NoteEditor />)

        type('S')
        type('Sh')
        type('Shop')
        act(() => vi.advanceTimersByTime(1000))
        type('Shop now')
        act(() => vi.advanceTimersByTime(1000))

        expect(useDocumentStore.getState().history.entries).toHaveLength(2)

        act(() => useDocumentStore.getState().undo())

        expect(screen.getByRole('textbox', {name: 'Note'})).toHaveValue('Shop')
    })

    it('undoes with the document history, taking back what was just typed', () => {
        render(<NoteEditor />)
        const field = screen.getByRole('textbox', {name: 'Note'})

        type('Milk')
        fireEvent.keyDown(field, {key: 'z', ctrlKey: true})

        expect(field).toHaveValue('')

        fireEvent.keyDown(field, {key: 'z', ctrlKey: true, shiftKey: true})

        expect(field).toHaveValue('Milk')
    })

    it('marks the note unsaved as soon as anything is typed', () => {
        render(<NoteEditor />)

        type('M')

        const {content, savedContent} = useDocumentStore.getState()

        expect(content).not.toBe(savedContent)
    })
})
