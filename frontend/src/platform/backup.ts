/**
 * Backups, from the frontend's side.
 *
 * Go writes and unpacks the zip and moves the files; this module asks it to,
 * picks the files with the system's own dialogs, and hears how far along it is.
 */

import {APP} from '../core/app'
import {textFromBinding} from './bytes'
import type {HeldStatus, RestoreChoice} from '../core/library/restore-plan'
import {desktopApp, desktopRuntime} from './shell'

const BACKUP_FILTERS = ['*.zip']
const PROGRESS_EVENT = 'backup:progress'

/** What backups ask of the core: dialogs, and holding the close while a backup is due. */
interface CoreBindings {
    SaveFileDialog(title: string, defaultName: string, filters: string[]): Promise<string>
    OpenFileDialog(title: string, filters: string[]): Promise<string>
    ChooseFolder(title: string, start: string): Promise<string>
    SetBusy(reason: string): Promise<void>
}

interface BackupBindings {
    BackUpToFile(path: string, extras: number[], appVersion: string): Promise<{documents: number; bytes: number}>
    OpenBackupFile(path: string): Promise<HeldBackupFile>
    ReadHeldDocument(id: string): Promise<unknown>
    RestoreFromHolding(choices: RestoreChoice[]): Promise<number>
    ClearHolding(): Promise<void>
    StopBackup(): Promise<void>
    LibraryFingerprint(): Promise<string>
    FolderExists(folder: string): Promise<boolean>
    PruneFolderBackups(folder: string, keep: number): Promise<number>
    SetCloudKeys(accessKey: string, secretKey: string): Promise<void>
    CloudKeys(): Promise<{saved: boolean; accessKey: string}>
    ForgetCloudKeys(): Promise<void>
    CheckCloudBackup(target: CloudTarget): Promise<void>
    BackUpToCloud(target: CloudTarget, extras: number[], appVersion: string): Promise<CloudSummary>
    OpenCloudBackup(target: CloudTarget): Promise<HeldBackupFile>
    CloudDocumentStatus(target: CloudTarget, id: string): Promise<string>
}

/** Whether a document is in the cloud backup as it is now. */
export type CloudDocumentStatus = 'backed-up' | 'changed' | 'not-yet'

/** Where cloud backups go: the settings, without the keys. */
export interface CloudTarget {
    readonly service: string
    readonly endpoint: string
    readonly region: string
    readonly bucket: string
    readonly folder: string
    readonly pathStyle: boolean
}

export interface CloudSummary {
    readonly documents: number
    readonly uploaded: number
    readonly changedElsewhere: number
    readonly removed: number
}

interface HeldBackupFile {
    app: string
    madeAt: string
    documents: {id: string; savedAt: string; size: number; hasPicture: boolean; status: HeldStatus}[] | null
    extras: string
}

const bindings = (): BackupBindings | undefined =>
    desktopApp<BackupBindings>('backup')

const BACKUPS_NEED_THE_APP = 'Backups need the desktop app.'

function backupBindings(): BackupBindings {
    const app = bindings()

    if (!app) {
        throw new Error(BACKUPS_NEED_THE_APP)
    }

    return app
}

function coreBindings(): CoreBindings {
    const app = desktopApp<CoreBindings>()

    if (!app) {
        throw new Error(BACKUPS_NEED_THE_APP)
    }

    return app
}

/** Backups move files on disk, so a plain browser can't make one. */
export const canBackUp = (): boolean => bindings() !== undefined

/** `wails-desktop-template-backup-2026-11-04.zip`, by the local date. */
export function backupFileName(now: Date = new Date()): string {
    const pad = (value: number) => String(value).padStart(2, '0')

    return `${APP.id}-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.zip`
}

/** Asks where to save a backup. Null when the person cancels. */
export async function chooseBackupTarget(): Promise<string | null> {
    return (await coreBindings().SaveFileDialog('Back up your work', backupFileName(), BACKUP_FILTERS)) || null
}

/** Asks for a backup to restore. Null when the person cancels. */
export async function chooseBackupSource(): Promise<string | null> {
    return (await coreBindings().OpenFileDialog('Restore from a backup', BACKUP_FILTERS)) || null
}

export async function backUpToFile(path: string, extras: string, appVersion: string): Promise<{documents: number; bytes: number}> {
    return backupBindings().BackUpToFile(path, [...new TextEncoder().encode(extras)], appVersion)
}

export interface HeldDocument {
    readonly id: string
    readonly savedAt: string
    readonly size: number
    readonly status: HeldStatus
    /** Where its picture is served while the backup is held, or null. */
    readonly picture: string | null
}

export interface HeldBackup {
    readonly app: string
    readonly madeAt: string
    readonly documents: readonly HeldDocument[]
    /** The extra text handed over when the backup was made, or empty. */
    readonly extras: string
}

export async function openBackupFile(path: string): Promise<HeldBackup> {
    return heldBackupFrom(await backupBindings().OpenBackupFile(path))
}

/** Downloads the cloud backup into the holding folder, as a file's is unpacked. */
export async function openCloudBackup(target: CloudTarget): Promise<HeldBackup> {
    return heldBackupFrom(await backupBindings().OpenCloudBackup(target))
}

function heldBackupFrom(held: HeldBackupFile): HeldBackup {
    return {
        app: held.app,
        madeAt: held.madeAt,
        extras: held.extras,
        documents: (held.documents ?? []).map((document) => ({
            id: document.id,
            savedAt: document.savedAt,
            size: document.size,
            status: document.status,
            picture: document.hasPicture ? `/documents/restoring/${encodeURIComponent(document.id)}.png?v=${encodeURIComponent(held.madeAt)}` : null,
        })),
    }
}

/** Saves the keys in the system's keychain. An empty secret keeps the one already saved. */
export const saveCloudKeys = (accessKey: string, secretKey: string): Promise<void> => backupBindings().SetCloudKeys(accessKey, secretKey)

/** Whether keys are saved, and the access key. The secret never comes back. */
export async function savedCloudKeys(): Promise<{saved: boolean; accessKey: string}> {
    return (await bindings()?.CloudKeys()) ?? {saved: false, accessKey: ''}
}

export const forgetCloudKeys = async (): Promise<void> => bindings()?.ForgetCloudKeys()

/** Asks Go, without any connection, whether one document is backed up to the cloud as it is now. */
export async function cloudDocumentStatus(target: CloudTarget, id: string): Promise<CloudDocumentStatus> {
    const status = await backupBindings().CloudDocumentStatus(target, id)

    return status === 'backed-up' || status === 'changed' ? status : 'not-yet'
}

export const checkCloudBackup = (target: CloudTarget): Promise<void> => backupBindings().CheckCloudBackup(target)

export async function backUpToCloud(target: CloudTarget, extras: string, appVersion: string): Promise<CloudSummary> {
    return backupBindings().BackUpToCloud(target, [...new TextEncoder().encode(extras)], appVersion)
}

export async function readHeldDocument(id: string): Promise<string> {
    return textFromBinding(await backupBindings().ReadHeldDocument(id))
}

export const restoreFromHolding = (choices: RestoreChoice[]): Promise<number> => backupBindings().RestoreFromHolding(choices)

/** Clears what a restore unpacked. Nothing to do in a browser. */
export async function clearHolding(): Promise<void> {
    await bindings()?.ClearHolding()
}

/** Sums up the saved documents without reading them, to tell whether anything changed. */
export const libraryFingerprint = (): Promise<string> => backupBindings().LibraryFingerprint()

/** Whether a folder is there now, such as a drive that may be unplugged. */
export const folderExists = (folder: string): Promise<boolean> => backupBindings().FolderExists(folder)

/** Keeps the newest of the app's own backups in a folder, and never touches anything else. */
export const pruneFolderBackups = (folder: string, keep: number): Promise<number> => backupBindings().PruneFolderBackups(folder, keep)

/** Tells the close guard a backup may be due, so closing comes to us first. */
export async function setBackupDue(due: boolean): Promise<void> {
    await desktopApp<CoreBindings>()?.SetBusy(due ? 'backup' : '')
}

/** Asks for the folder automatic backups go to. Null when the person cancels. */
export async function chooseBackupFolder(start: string): Promise<string | null> {
    return (await coreBindings().ChooseFolder('Back up to this folder', start)) || null
}

export const stopBackup = async (): Promise<void> => bindings()?.StopBackup()

/** Calls back as a backup or restore goes, with how many files are done of how many. */
export function onBackupProgress(handler: (done: number, total: number) => void): () => void {
    return desktopRuntime()?.EventsOn(PROGRESS_EVENT, handler) ?? (() => {})
}
