import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {DEFAULT_CLOUD_BACKUP} from '../../core/settings/settings-spec'
import type {SavedDocument} from '../../platform/documents'
import {fakeDesktop} from '../../platform/shell'
import {useSettingsStore} from '../../store/settings-store'
import {CloudStatusFacts} from './CloudStatusFacts'

const document = (id: string): SavedDocument => ({id, name: id, kind: 'note', createdAt: null, savedAt: '2026-11-01T10:00:00Z', size: 1, thumbnail: null})

afterEach(() => {
    cleanup()
    fakeDesktop()
})

describe('the backup line on the library page', () => {
    it('says whether a document is backed up to the cloud as it is now', async () => {
        fakeDesktop({CloudDocumentStatus: vi.fn(async (_target: unknown, id: string) => (id === 'shop' ? 'backed-up' : 'changed'))})
        useSettingsStore.setState({cloudBackup: {...DEFAULT_CLOUD_BACKUP, service: 'r2', endpoint: 'abc.r2.cloudflarestorage.com', bucket: 'b'}})

        const {rerender} = render(<dl><CloudStatusFacts document={document('shop')} /></dl>)

        expect(await screen.findByText('Backed up to the cloud')).toBeInTheDocument()

        rerender(<dl><CloudStatusFacts document={document('recipes')} /></dl>)

        expect(await screen.findByText('Changed since the last backup')).toBeInTheDocument()
    })

    it('says nothing when there is no cloud backup', () => {
        useSettingsStore.setState({cloudBackup: DEFAULT_CLOUD_BACKUP})
        render(<dl><CloudStatusFacts document={document('shop')} /></dl>)

        expect(screen.queryByText('Backup')).toBeNull()
    })
})
