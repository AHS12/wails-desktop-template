/**
 * Backups: to a file, to a folder by itself, and to cloud storage the person
 * already has; and bringing work back from any of them.
 *
 * The Go side is backend/backup, registered in main.go.
 */

import './backup.css'
import {ArchiveRestore, CloudDownload, CloudUpload} from 'lucide-react'
import {BringBack} from './BringBack'
import type {Feature} from '../../shell/feature'
import {useDocumentStore} from '../../store/document-store'
import {useSettingsStore} from '../../store/settings-store'
import {BackupSettings} from './BackupSettings'
import {useBackupAttention, useBackupStore} from './backup-store'
import {CloudSetupDialog} from './CloudSetupDialog'
import {ClosingDialog} from './ClosingDialog'
import {CloudStatusFacts} from './CloudStatusFacts'
import {canBackUp, clearHolding} from './platform'
import {RestoreDialog} from './RestoreDialog'

const NEEDS_THE_APP = 'Backups need the desktop app.'

/** A few seconds after start, so the first screen settles before any backup reads the disk. */
const STARTUP_BACKUP_DELAY_MS = 3000

const needsDesktop = () => (canBackUp() ? null : NEEDS_THE_APP)

const needsCloud = () =>
    !canBackUp() ? NEEDS_THE_APP : useSettingsStore.getState().cloudBackup.service ? null : 'Set up cloud backup in Settings, Backup first.'

export const backup: Feature = {
    id: 'backup',
    commands: [
        {
            id: 'back-up',
            label: 'Back up to a file…',
            group: 'File',
            icon: ArchiveRestore,
            global: true,
            keywords: 'backup save zip copy safe keep all another computer',
            unavailable: needsDesktop,
            run: () => void useBackupStore.getState().backUp(),
        },
        {
            id: 'restore-backup',
            label: 'Restore from a backup…',
            group: 'File',
            icon: ArchiveRestore,
            global: true,
            keywords: 'restore backup zip bring back load import another computer',
            unavailable: needsDesktop,
            run: () => void useBackupStore.getState().openRestore(),
        },
        {
            id: 'back-up-cloud',
            label: 'Back up to the cloud now',
            group: 'File',
            icon: CloudUpload,
            global: true,
            keywords: 'backup cloud s3 r2 b2 bucket upload sync',
            unavailable: needsCloud,
            run: () => void useBackupStore.getState().backUpToCloudNow(),
        },
        {
            id: 'restore-cloud',
            label: 'Restore from the cloud…',
            group: 'File',
            icon: CloudDownload,
            global: true,
            keywords: 'restore cloud s3 r2 b2 bucket download bring back another computer',
            unavailable: needsCloud,
            run: () => void useBackupStore.getState().openCloudRestore(),
        },
    ],
    menus: {File: ['back-up', 'restore-backup']},
    settingsPages: [{id: 'Backup', icon: ArchiveRestore, Page: BackupSettings, useAttention: useBackupAttention}],
    dialogs: [RestoreDialog, CloudSetupDialog, ClosingDialog],
    start: () => {
        // Whatever a restore left unpacked when the app last closed.
        void clearHolding().catch(() => undefined)
        // Catches changes from a session that closed before its backup ran.
        void useBackupStore.getState().refreshBackupDue()

        const timer = window.setTimeout(() => void useBackupStore.getState().runAutoBackups(), STARTUP_BACKUP_DELAY_MS)

        // A save, rename or removal: back up a minute after the last one.
        const unwatch = useDocumentStore.subscribe((state, previous) => {
            if (state.documents !== previous.documents) {
                useBackupStore.getState().scheduleBackups()
            }
        })

        return () => {
            window.clearTimeout(timer)
            unwatch()
        }
    },
    beforeClose: () => useBackupStore.getState().backUpBeforeClosing(),
    HomeEmpty: BringBack,
    DocumentFacts: CloudStatusFacts,
}
