import {cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {backupFileName} from './platform'
import {NEWER_BACKUP, useBackupStore} from './backup-store'
import {useDocumentStore} from '../../store/document-store'
import {RestoreDialog} from './RestoreDialog'
import {fakeDesktop} from '../../platform/shell'

const noteText = (name: string) => JSON.stringify({name, kind: 'note', content: {text: 'Hello'}})

const held = {
    app: '0.4.0',
    madeAt: '2026-11-01T10:00:00Z',
    palettes: '',
    documents: [
        {id: 'ideas', savedAt: '2026-10-01T10:00:00Z', size: 10, hasPicture: false, status: 'new'},
        {id: 'shop', savedAt: '2026-10-02T10:00:00Z', size: 10, hasPicture: false, status: 'different'},
        {id: 'recipes', savedAt: '2026-10-03T10:00:00Z', size: 10, hasPicture: false, status: 'same'},
    ],
}

const names: Record<string, string> = {ideas: 'Ideas', shop: 'Shopping', recipes: 'Recipes'}

let app: Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
    app = {
        OpenFileDialog: vi.fn(async () => 'C:/backups/my-backup.zip'),
        SaveFileDialog: vi.fn(async () => 'C:/backups/my-backup.zip'),
        OpenBackupFile: vi.fn(async () => held),
        ReadHeldDocument: vi.fn(async (id: string) => [...new TextEncoder().encode(noteText(names[id]))]),
        RestoreFromHolding: vi.fn(async (choices: unknown[]) => choices.length),
        ClearHolding: vi.fn(async () => undefined),
        BackUpToFile: vi.fn(async () => ({documents: 3, bytes: 100})),
        StopBackup: vi.fn(async () => undefined),
        ListDocuments: vi.fn(async () => []),
        ReadDocumentsIndex: vi.fn(async () => null),
        WriteDocumentsIndex: vi.fn(async () => undefined),
        WriteSettings: vi.fn(async () => undefined),
    }
    fakeDesktop(app)
    useBackupStore.setState({phase: 'idle', progress: null, restoring: null})
    useDocumentStore.setState({toast: null, documents: [{name: 'Shopping'} as never]})
})

afterEach(() => {
    cleanup()
    fakeDesktop()
})

async function openTheBackup() {
    render(<RestoreDialog />)
    await useBackupStore.getState().openRestore()
    await screen.findByRole('dialog')
}

describe('restoring from a backup', () => {
    it('shows new documents and ones that differ, ticked, and says how many are already here', async () => {
        await openTheBackup()

        const fresh = screen.getByRole('region', {name: 'New to this computer'})
        const different = screen.getByRole('region', {name: 'Different from the one here'})

        expect(within(fresh).getByRole('checkbox', {name: 'Ideas'})).toHaveAttribute('aria-checked', 'true')
        expect(within(different).getByRole('checkbox', {name: 'Shopping'})).toHaveAttribute('aria-checked', 'true')
        expect(screen.queryByRole('checkbox', {name: 'Recipes'})).toBeNull()
        expect(screen.getByText(/1 note is already here/)).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Restore 2 notes'})).toBeEnabled()
    })

    it('brings in a document that differs as a renamed second copy', async () => {
        await openTheBackup()

        fireEvent.click(screen.getByRole('button', {name: 'Restore 2 notes'}))

        await waitFor(() => expect(app.RestoreFromHolding).toHaveBeenCalled())

        const [choices] = app.RestoreFromHolding.mock.calls[0] as [{id: string; copyId: string; copyContents: string}[]]

        expect(choices[0]).toEqual({id: 'ideas', copyId: '', copyContents: ''})
        expect(choices[1].id).toBe('shop')
        expect(choices[1].copyId).not.toBe('')
        expect(JSON.parse(choices[1].copyContents).name).toBe('Shopping (from backup)')

        await waitFor(() => expect(useDocumentStore.getState().toast?.message).toBe('Restored 2 notes'))
        expect(app.ClearHolding).toHaveBeenCalled()
        expect(useBackupStore.getState().restoring).toBeNull()
    })

    it('leaves out a document that is unticked', async () => {
        await openTheBackup()

        fireEvent.click(screen.getByRole('checkbox', {name: 'Shopping'}))
        fireEvent.click(screen.getByRole('button', {name: 'Restore 1 note'}))

        await waitFor(() => expect(app.RestoreFromHolding).toHaveBeenCalledWith([{id: 'ideas', copyId: '', copyContents: ''}]))
    })

    it('clears what it unpacked when cancelled', async () => {
        await openTheBackup()

        fireEvent.click(screen.getByRole('button', {name: 'Cancel'}))

        await waitFor(() => expect(app.ClearHolding).toHaveBeenCalled())
        expect(app.RestoreFromHolding).not.toHaveBeenCalled()
        expect(useBackupStore.getState().restoring).toBeNull()
    })

    it('says plainly when a backup comes from a newer app', async () => {
        app.OpenBackupFile.mockRejectedValue(new Error('this backup was made by a newer version of the app'))

        await useBackupStore.getState().openRestore()

        expect(useDocumentStore.getState().toast?.message).toBe(NEWER_BACKUP)
        expect(useBackupStore.getState().restoring).toBeNull()
    })

    it('does nothing when the person cancels choosing a file', async () => {
        app.OpenFileDialog.mockResolvedValue('')

        await useBackupStore.getState().openRestore()

        expect(app.OpenBackupFile).not.toHaveBeenCalled()
    })
})

describe('backing up to a file', () => {
    it('offers a dated name, and says how many documents it saved', async () => {
        await useBackupStore.getState().backUp()

        expect(app.SaveFileDialog).toHaveBeenCalledWith('Back up your work', backupFileName(), ['*.zip'])

        const [path] = app.BackUpToFile.mock.calls[0] as [string, number[]]

        expect(path).toBe('C:/backups/my-backup.zip')
        expect(useDocumentStore.getState().toast).toMatchObject({message: 'Backed up 3 notes', folder: 'C:/backups'})
    })

    it('names the file by the local date', () => {
        expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe('wails-desktop-template-backup-2026-01-05.zip')
    })
})
