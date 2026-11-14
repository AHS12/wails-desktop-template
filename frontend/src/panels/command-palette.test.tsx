import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, beforeAll, describe, expect, it} from 'vitest'
import {useDocumentStore} from '../store/document-store'
import {useUiStore} from '../store/ui-store'
import {CommandPalette} from './CommandPalette'

beforeAll(() => {
    // The test page has no layout, so it has nothing to scroll.
    Element.prototype.scrollIntoView = () => undefined
})

afterEach(() => {
    cleanup()
    useUiStore.setState({paletteOpen: false})
    useDocumentStore.setState({page: 'home'})
})

describe('the empty palette', () => {
    it('suggests ways to get a document on Home, instead of saying nothing matches', () => {
        useDocumentStore.setState({page: 'home'})
        useUiStore.setState({paletteOpen: true})
        render(<CommandPalette />)

        expect(screen.getByRole('option', {name: /New note/})).toBeInTheDocument()
        expect(screen.getByRole('option', {name: /Open a file/})).toBeInTheDocument()
        expect(screen.queryByText('Nothing matches that. Try a shorter word.')).toBeNull()
    })

    it('suggests working on the document in the editor', () => {
        useDocumentStore.setState({page: 'editor'})
        useUiStore.setState({paletteOpen: true})
        render(<CommandPalette />)

        expect(screen.getByRole('option', {name: /^Save/})).toBeInTheDocument()
    })
})

describe('finding the bin', () => {
    it('finds Recently removed by "bin", and opens it in Settings', () => {
        useDocumentStore.setState({page: 'home'})
        useUiStore.setState({paletteOpen: true})
        render(<CommandPalette />)

        fireEvent.change(screen.getByRole('combobox'), {target: {value: 'bin'}})

        expect(screen.getAllByRole('option')[0].textContent).toContain('Recently removed')

        fireEvent.click(screen.getByRole('option', {name: /Recently removed/}))

        expect(useUiStore.getState().settingsPage).toBe('Recently removed')
        useUiStore.getState().closeSettings()
    })
})
