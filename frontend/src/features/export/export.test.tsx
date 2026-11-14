import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {fakeDesktop} from '../../platform/shell'
import {useDocumentStore} from '../../store/document-store'
import {ExportDialog} from './ExportDialog'
import {ExportManyDialog} from './ExportManyDialog'
import {useExportStore} from './export-store'

const noteFile = (name: string, text: string) =>
    JSON.stringify({version: 1, generator: 'wails-desktop-template', kind: 'note', createdAt: '2026-11-01T00:00:00Z', modifiedAt: '2026-11-01T00:00:00Z', name, content: {text}})

/** A folder in memory, and a library, changed as Go would change them. */
function fakeApp(existing: string[] = []) {
    const written = new Map<string, string>()
    const library = new Map([
        ['shop', noteFile('Shopping', 'Milk')],
        ['ideas', noteFile('Ideas', 'Paint the fence')],
        ['broken', 'not a note'],
    ])

    return {
        written,
        ChooseFolder: vi.fn(async () => 'C:/Exports'),
        ExistingFiles: vi.fn(async (_folder: string, names: string[]) => names.filter((name) => existing.includes(name) || written.has(name))),
        WriteFiles: vi.fn(async (folder: string, files: {name: string; contents: number[]}[]) => {
            for (const file of files) {
                written.set(file.name, new TextDecoder().decode(new Uint8Array(file.contents)))
            }

            return folder
        }),
        ListDocuments: vi.fn(async () => [...library.keys()].map((id) => ({id, savedAt: '2026-11-01T10:00:00Z', size: 1, hasPicture: false}))),
        ReadDocument: vi.fn(async (id: string) => [...new TextEncoder().encode(library.get(id) ?? '')]),
        ReadDocumentsIndex: vi.fn(async () => null),
        WriteDocumentsIndex: vi.fn(async () => undefined),
    }
}

let app: ReturnType<typeof fakeApp>

beforeEach(() => {
    window.localStorage.clear()
    app = fakeApp()
    fakeDesktop(app)
    useDocumentStore.setState({name: 'Shopping', content: {text: 'Milk'}, toast: null, documents: []})
    useExportStore.setState({dialog: null, picked: [], run: null})
})

afterEach(() => {
    cleanup()
    fakeDesktop()
})

describe('exporting the open document', () => {
    it('writes each format picked into the chosen folder, and says where', async () => {
        render(<ExportDialog />)
        act(() => useExportStore.getState().openOne())

        fireEvent.click(screen.getByRole('checkbox', {name: /Plain text/}))
        fireEvent.click(screen.getByRole('button', {name: 'Export'}))

        await waitFor(() => expect(app.WriteFiles).toHaveBeenCalled())
        expect(app.WriteFiles.mock.calls[0][0]).toBe('C:/Exports')
        expect([...app.written.keys()]).toEqual(['Shopping.md', 'Shopping.txt'])
        expect(useDocumentStore.getState().toast).toMatchObject({message: 'Exported 2 files', folder: 'C:/Exports'})
        expect(useExportStore.getState().dialog).toBeNull()
    })

    it('names the files already there, and replaces them only when asked', async () => {
        app = fakeApp(['Shopping.md'])
        fakeDesktop(app)
        render(<ExportDialog />)
        act(() => useExportStore.getState().openOne())

        fireEvent.click(screen.getByRole('button', {name: 'Export'}))

        expect(await screen.findByText(/1 file is there already: Shopping.md/)).toBeInTheDocument()
        expect(app.WriteFiles).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', {name: 'Keep them'}))
        fireEvent.click(screen.getByRole('button', {name: 'Export'}))
        fireEvent.click(await screen.findByRole('button', {name: 'Replace'}))

        await waitFor(() => expect(app.written.get('Shopping.md')).toBe('# Shopping\n\nMilk\n'))
    })

    it('remembers the folder for next time', async () => {
        render(<ExportDialog />)
        act(() => useExportStore.getState().openOne())
        fireEvent.click(screen.getByRole('button', {name: 'Export'}))
        await waitFor(() => expect(app.WriteFiles).toHaveBeenCalled())

        act(() => useExportStore.getState().openOne())

        expect(screen.getByText('C:/Exports')).toBeInTheDocument()
    })
})

describe('exporting many documents', () => {
    it('exports the ticked ones, and says which it couldn\'t', async () => {
        render(<ExportManyDialog />)
        act(() => useExportStore.getState().openMany(['shop', 'ideas']))

        await screen.findByRole('checkbox', {name: 'Ideas'})
        fireEvent.click(screen.getByRole('button', {name: 'Export 2 notes'}))

        expect(await screen.findByText('Exported 2 notes.')).toBeInTheDocument()
        expect([...app.written.keys()].sort()).toEqual(['Ideas.md', 'Shopping.md'])
    })

    it('lists a file it can\'t read as one it couldn\'t export, and carries on', async () => {
        useExportStore.setState({run: null})
        await useExportStore.getState().exportMany(
            [
                {id: 'broken', name: 'Old one'},
                {id: 'ideas', name: 'Ideas'},
            ],
            ['markdown'],
            'C:/Exports',
        )

        expect(useExportStore.getState().run).toMatchObject({done: 2, failed: ['Old one'], finished: true})
        expect(app.written.has('Ideas.md')).toBe(true)
    })

    it('stops between documents when asked', async () => {
        const exporting = useExportStore.getState().exportMany(
            [
                {id: 'shop', name: 'Shopping'},
                {id: 'ideas', name: 'Ideas'},
            ],
            ['markdown'],
            'C:/Exports',
        )

        useExportStore.getState().stop()
        await exporting

        expect(useExportStore.getState().run).toMatchObject({stopped: true, finished: true})
        expect(app.written.size).toBeLessThan(2)
    })
})
