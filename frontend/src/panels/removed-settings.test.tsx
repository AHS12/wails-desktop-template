import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {useDocumentStore} from '../store/document-store'
import {useUiStore} from '../store/ui-store'
import {SettingsDialog} from './SettingsDialog'
import {fakeDesktop} from '../platform/shell'

const documentOf = (name: string) => JSON.stringify({name, kind: 'note', content: {text: ''}})

/** Recently removed, kept in memory and changed as Go would change it. */
function fakeBin() {
    const bin = new Map<string, string>([
        ['shop', documentOf('Shopping')],
        ['recipes', documentOf('Recipes')],
    ])
    const saved = new Set<string>()

    return {
        bin,
        saved,
        ListRemovedDocuments: vi.fn(async () =>
            [...bin.keys()].map((id) => ({id, savedAt: '2026-11-01T10:00:00Z', removedAt: '2026-11-04T09:00:00Z', size: 1, hasPicture: false})),
        ),
        ReadRemovedDocument: vi.fn(async (id: string) => [...new TextEncoder().encode(bin.get(id) ?? '')]),
        PutBackDocument: vi.fn(async (id: string) => {
            bin.delete(id)
            saved.add(id)
        }),
        ForgetRemovedDocument: vi.fn(async (id: string) => void bin.delete(id)),
        ListDocuments: vi.fn(async () => []),
        ReadDocumentsIndex: vi.fn(async () => null),
        WriteDocumentsIndex: vi.fn(async () => undefined),
        GetLibraryInfo: vi.fn(async () => ({folder: 'C:/notes', documents: 0, bytes: 0})),
        ReadSettings: vi.fn(async () => null),
        WriteSettings: vi.fn(async () => undefined),
    }
}

let app: ReturnType<typeof fakeBin>

beforeEach(() => {
    app = fakeBin()
    fakeDesktop(app)
    useDocumentStore.setState({removed: [], toast: null})
    useUiStore.getState().openSettings('Recently removed')
})

afterEach(() => {
    cleanup()
    useUiStore.getState().closeSettings()
    fakeDesktop()
})

describe('Recently removed in Settings', () => {
    it('lists what was removed', async () => {
        render(<SettingsDialog />)

        expect(await screen.findByText('Shopping')).toBeInTheDocument()
        expect(screen.getByText('Recipes')).toBeInTheDocument()
    })

    it('puts a document back', async () => {
        render(<SettingsDialog />)

        fireEvent.click(await screen.findByRole('button', {name: 'Put back Shopping'}))

        await waitFor(() => expect(screen.queryByText('Shopping')).toBeNull())
        expect(app.saved.has('shop')).toBe(true)
    })

    it('asks before removing a document for good', async () => {
        render(<SettingsDialog />)

        fireEvent.click(await screen.findByRole('button', {name: 'Remove Recipes for good'}))

        expect(app.ForgetRemovedDocument).not.toHaveBeenCalled()

        fireEvent.click(within(screen.getByRole('group', {name: /Remove “Recipes” for good/})).getByRole('button', {name: 'Remove for good'}))

        await waitFor(() => expect(app.ForgetRemovedDocument).toHaveBeenCalledWith('recipes'))
    })

    it('removes everything for good after asking', async () => {
        render(<SettingsDialog />)

        fireEvent.click(await screen.findByRole('button', {name: 'Remove all for good'}))
        fireEvent.click(within(screen.getByRole('group', {name: /Remove all 2 notes for good/})).getByRole('button', {name: 'Remove for good'}))

        await waitFor(() => expect(screen.getByText('Nothing here.')).toBeInTheDocument())
        expect(app.bin.size).toBe(0)
        expect(app.saved.size).toBe(0)
    })

    it('puts everything back at once', async () => {
        render(<SettingsDialog />)

        fireEvent.click(await screen.findByRole('button', {name: 'Put all back'}))

        await waitFor(() => expect(app.saved.size).toBe(2))
    })

    it('is reached from the Storage page', async () => {
        useUiStore.getState().openSettings('Storage')
        render(<SettingsDialog />)

        await waitFor(() => expect(screen.getByText(/2 notes, kept for 30 days/)).toBeInTheDocument())

        fireEvent.click(screen.getByRole('button', {name: 'Show'}))

        expect(await screen.findByText('Shopping')).toBeInTheDocument()
    })
})
