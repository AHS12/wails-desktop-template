import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {Toast} from '../panels/Toast'
import {DEFAULT_CLOUD_BACKUP} from '../core/settings/settings-spec'
import {useDocumentStore} from '../store/document-store'
import {useSettingsStore} from '../store/settings-store'
import {DocumentsPage} from './DocumentsPage'
import {fakeDesktop} from '../platform/shell'

const documentOf = (name: string, text: string) =>
    JSON.stringify({
        version: 1,
        generator: 'wails-desktop-template',
        kind: 'note',
        createdAt: '2026-10-02T09:00:00.000Z',
        modifiedAt: '2026-11-01T09:00:00.000Z',
        name,
        content: {text},
    })

interface File {
    contents: string
    savedAt: string
}

/** A saved documents folder and Recently removed, kept in memory and changed as Go would change them. */
function fakeLibrary() {
    const saved = new Map<string, File>([
        ['shop', {contents: documentOf('Shopping', 'Milk'), savedAt: '2026-11-03T10:00:00Z'}],
        ['garden', {contents: documentOf('Garden ideas', 'Roses'), savedAt: '2026-11-02T10:00:00Z'}],
        ['recipes', {contents: documentOf('Recipes', 'Soup'), savedAt: '2026-11-01T10:00:00Z'}],
    ])
    const bin = new Map<string, File>()
    const bytes = (text: string) => [...new TextEncoder().encode(text)]
    const move = (from: Map<string, File>, to: Map<string, File>, id: string) => {
        const file = from.get(id)

        if (!file || to.has(id)) {
            throw new Error(`cannot move ${id}`)
        }

        from.delete(id)
        to.set(id, file)
    }

    return {
        saved,
        bin,
        ListProps: vi.fn(async () =>
            [...saved].map(([id, file]) => ({id, savedAt: file.savedAt, size: file.contents.length, hasPicture: true})),
        ),
        ReadProp: vi.fn(async (id: string) => bytes(saved.get(id)?.contents ?? '')),
        WriteProp: vi.fn(async (id: string, contents: number[]) => {
            saved.set(id, {contents: new TextDecoder().decode(new Uint8Array(contents)), savedAt: '2026-11-04T10:00:00Z'})
        }),
        CopyPropPicture: vi.fn(async () => undefined),
        ReadPropsIndex: vi.fn(async () => null),
        WritePropsIndex: vi.fn(async () => undefined),
        ShowProp: vi.fn(async () => undefined),
        RemoveProp: vi.fn(async (id: string) => move(saved, bin, id)),
        PutBackProp: vi.fn(async (id: string) => move(bin, saved, id)),
        ForgetRemovedProp: vi.fn(async (id: string) => void bin.delete(id)),
        ListRemovedProps: vi.fn(async () =>
            [...bin].map(([id, file]) => ({id, savedAt: file.savedAt, removedAt: '2026-11-04T09:00:00Z', size: 1, hasPicture: false})),
        ),
        ReadRemovedProp: vi.fn(async (id: string) => bytes(bin.get(id)?.contents ?? '')),
    }
}

let app: ReturnType<typeof fakeLibrary>
const open = vi.fn(async () => undefined)

beforeEach(() => {
    app = fakeLibrary()
    fakeDesktop(app)
    useDocumentStore.setState({
        page: 'documents',
        pickedId: null,
        removed: [],
        toast: null,
        currentId: null,
        open,
    })
})

afterEach(() => {
    cleanup()
    fakeDesktop()
    open.mockClear()
})

const tile = (name: string) => screen.getByRole('button', {name: new RegExp(`^${name}`)})

async function showPage() {
    render(
        <>
            <DocumentsPage />
            <Toast />
        </>,
    )
    await waitFor(() => expect(tile('Shopping')).toBeInTheDocument())
}

describe('Your notes page', () => {
    it('lists every saved document, newest first', async () => {
        await showPage()

        const names = [...document.querySelectorAll('[data-document-id]')].map((tile) => tile.getAttribute('title'))

        expect(names).toEqual(['Shopping', 'Garden ideas', 'Recipes'])
    })

    it('says what the picked document is beside the list', async () => {
        await showPage()

        fireEvent.click(tile('Garden ideas'))

        const details = screen.getByRole('complementary', {name: 'About Garden ideas'})

        // The date is written the way the system writes dates, so only the year is certain.
        expect(within(details).getByText('Made').nextElementSibling?.textContent).toMatch(/2026/)
    })

    it('opens the picked document with Enter', async () => {
        await showPage()

        fireEvent.click(tile('Recipes'))
        fireEvent.keyDown(tile('Recipes'), {key: 'Enter'})

        expect(open).toHaveBeenCalledWith('recipes')
    })

    it('finds a document by part of its name', async () => {
        await showPage()

        fireEvent.change(screen.getByRole('textbox', {name: 'Search your notes'}), {target: {value: 'gard'}})

        expect(screen.queryByRole('button', {name: /^Shopping/})).toBeNull()
        expect(tile('Garden ideas')).toBeInTheDocument()
    })

    it('shows a document in its folder', async () => {
        await showPage()

        fireEvent.click(screen.getByRole('button', {name: 'Show in folder'}))

        await waitFor(() => expect(app.ShowProp).toHaveBeenCalledWith('shop'))
    })
})

describe('removing documents', () => {
    it('moves a document to Recently removed without asking, and Undo puts it back', async () => {
        await showPage()

        fireEvent.click(tile('Recipes'))
        fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', {name: /Remove/}))

        await waitFor(() => expect(screen.queryByRole('button', {name: /^Recipes/})).toBeNull())
        expect(app.bin.has('recipes')).toBe(true)
        expect(screen.getByText('Removed "Recipes"')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', {name: 'Undo'}))

        await waitFor(() => expect(tile('Recipes')).toBeInTheDocument())
        expect(app.saved.has('recipes')).toBe(true)
        expect(app.bin.size).toBe(0)
        expect(screen.getByRole('complementary', {name: 'About Recipes'})).toBeInTheDocument()
    })

    it('lists removed documents under Recently removed, where they can be put back', async () => {
        await showPage()

        fireEvent.click(tile('Recipes'))
        fireEvent.keyDown(tile('Recipes'), {key: 'Delete'})

        fireEvent.click(await screen.findByRole('button', {name: 'Recently removed (1)'}))

        const bin = screen.getByRole('region', {name: 'Recently removed'})

        expect(within(bin).getByText('Recipes')).toBeInTheDocument()

        fireEvent.click(within(bin).getByRole('button', {name: /Put back/}))

        await waitFor(() => expect(app.saved.has('recipes')).toBe(true))
        await waitFor(() => expect(within(bin).getByText('Nothing here.')).toBeInTheDocument())
    })

    it('asks before removing a document for good', async () => {
        await showPage()

        fireEvent.keyDown(tile('Shopping'), {key: 'Delete'})
        fireEvent.click(await screen.findByRole('button', {name: 'Recently removed (1)'}))
        fireEvent.click(screen.getByRole('button', {name: 'Remove Shopping for good'}))

        expect(app.ForgetRemovedProp).not.toHaveBeenCalled()

        fireEvent.click(within(screen.getByRole('group', {name: /Remove “Shopping” for good/})).getByRole('button', {name: 'Remove for good'}))

        await waitFor(() => expect(app.ForgetRemovedProp).toHaveBeenCalledWith('shop'))
    })
})

describe('copying a document', () => {
    it('saves a copy named after it, with its picture, and picks the copy', async () => {
        await showPage()

        fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', {name: /Copy/}))

        await waitFor(() => expect(tile('Shopping copy')).toBeInTheDocument())

        const [[copyId, contents]] = app.WriteProp.mock.calls
        const copy = JSON.parse(new TextDecoder().decode(new Uint8Array(contents)))

        expect(copy.name).toBe('Shopping copy')
        expect(copy.createdAt).not.toBe('2026-10-02T09:00:00.000Z')
        expect(app.CopyPropPicture).toHaveBeenCalledWith('shop', copyId)
        expect(screen.getByRole('complementary', {name: 'About Shopping copy'})).toBeInTheDocument()
        expect(app.saved.get('shop')?.contents).toBe(documentOf('Shopping', 'Milk'))
    })
})

describe('ticking several documents', () => {
    it('ticks with Ctrl-click and acts on all of them at once', async () => {
        await showPage()

        fireEvent.click(tile('Shopping'))
        fireEvent.click(tile('Recipes'), {ctrlKey: true})

        const panel = screen.getByRole('complementary', {name: '2 notes ticked'})

        fireEvent.click(within(panel).getByRole('button', {name: /Remove/}))

        await waitFor(() => expect(app.saved.size).toBe(1))
    })

    it('ticks a run with Shift-click', async () => {
        await showPage()

        fireEvent.click(tile('Shopping'))
        fireEvent.click(tile('Recipes'), {shiftKey: true})

        expect(screen.getByRole('complementary', {name: '3 notes ticked'})).toBeInTheDocument()
    })

    it('removes every ticked document, and Undo brings them all back', async () => {
        await showPage()

        fireEvent.click(tile('Shopping'))
        fireEvent.click(tile('Garden ideas'), {ctrlKey: true})
        fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', {name: /Remove/}))

        await waitFor(() => expect(screen.getByText('Removed 2 notes')).toBeInTheDocument())
        expect(app.saved.size).toBe(1)

        fireEvent.click(screen.getByRole('button', {name: 'Undo'}))

        await waitFor(() => expect(app.saved.size).toBe(3))
    })

    it('clears the ticks with Escape', async () => {
        await showPage()

        fireEvent.click(tile('Shopping'))
        fireEvent.click(tile('Recipes'), {ctrlKey: true})

        act(() => {
            fireEvent.keyDown(tile('Recipes'), {key: 'Escape'})
        })

        expect(screen.queryByRole('complementary', {name: /ticked/})).toBeNull()
    })
})

describe('the backup line in the panel', () => {
    it('says whether the picked document is backed up to the cloud', async () => {
        const status = vi.fn(async (_target: unknown, id: string) => (id === 'shop' ? 'backed-up' : 'changed'))
        fakeDesktop({...app, CloudPropStatus: status})
        useSettingsStore.setState({cloudBackup: {...DEFAULT_CLOUD_BACKUP, service: 'r2', endpoint: 'abc.r2.cloudflarestorage.com', bucket: 'b'}})

        await showPage()

        const details = screen.getByRole('complementary', {name: 'About Shopping'})

        await waitFor(() => expect(within(details).getByText('Backed up to the cloud')).toBeInTheDocument())

        fireEvent.click(tile('Recipes'))

        await waitFor(() => expect(screen.getByText('Changed since the last backup')).toBeInTheDocument())
    })

    it('says nothing about backups when there is no cloud backup', async () => {
        useSettingsStore.setState({cloudBackup: DEFAULT_CLOUD_BACKUP})

        await showPage()

        expect(screen.queryByText('Backup')).toBeNull()
    })
})
