/**
 * Settings, Backup: backing up to a file, to a folder by itself, and to the cloud;
 * and restoring from each.
 */

import {Select, Switch} from '../../components/controls'
import {SettingRow} from '../../shell/SettingRow'
import {useSettingsStore} from '../../store/settings-store'
import {useBackupStore} from './backup-store'
import {findCloudService} from './cloud-services'
import {canBackUp} from './platform'

const KEEP_CHOICES = ['5', '10', '20', '30'].map((value) => ({value, label: `The last ${value}`}))

/** When the last folder backup was made, in the fewest words that are still true. */
function lastBackupLabel(iso: string): string {
    const at = new Date(iso)

    if (!iso || Number.isNaN(at.getTime())) {
        return 'None yet. The first is made as soon as there is something to back up.'
    }

    const time = new Intl.DateTimeFormat(undefined, {hour: 'numeric', minute: '2-digit'}).format(at)
    const sameDay = at.toDateString() === new Date().toDateString()

    return sameDay
        ? `Today at ${time}.`
        : `${new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'short'}).format(at)} at ${time}.`
}

/** Backing up to a folder by itself, once a day when something changed. */
function FolderBackupRows() {
    const backup = useSettingsStore((state) => state.folderBackup)
    const setFolderBackup = useSettingsStore((state) => state.setFolderBackup)
    const problem = useBackupStore((state) => state.folderProblem)
    const chooseFolder = useBackupStore((state) => state.chooseFolder)
    const turnOff = useBackupStore((state) => state.turnOffFolderBackup)
    const busy = useBackupStore((state) => state.phase !== 'idle')

    return (
        <>
            <h3 className="settings__group">Back up by itself</h3>
            <SettingRow
                label="Back up to a folder"
                help={
                    backup.folder ||
                    'Once a day, when something changed, a dated backup goes in a folder you choose, such as a synced folder or an external drive.'
                }
            >
                {backup.folder ? (
                    <button type="button" className="text-button" onClick={turnOff}>
                        Turn off
                    </button>
                ) : null}
                <button type="button" className="button" disabled={busy} onClick={() => void chooseFolder()}>
                    {backup.folder ? 'Change…' : 'Choose a folder…'}
                </button>
            </SettingRow>
            {backup.folder ? (
                <>
                    <SettingRow label="Backups to keep" help="Older ones the app made are removed. Nothing else in the folder is touched.">
                        <Select<string>
                            label="Backups to keep"
                            value={String(backup.keep)}
                            options={KEEP_CHOICES}
                            onChange={(value) => setFolderBackup({keep: Number(value)})}
                        />
                    </SettingRow>
                    <SettingRow label="Last backup there" help={problem ?? lastBackupLabel(backup.lastAt)}>
                        {problem ? <span className="setting__warning">Not backed up</span> : null}
                    </SettingRow>
                    <p className="settings__intro">
                        It backs up a minute after you save, when the app starts, and when it closes. Nothing runs while the app is
                        closed, and nothing needs to: your work only changes while it's open.
                    </p>
                </>
            ) : null}
        </>
    )
}

/** Backing up to storage the person already has, over the S3 API. */
function CloudBackupRows() {
    const cloud = useSettingsStore((state) => state.cloudBackup)
    const problem = useBackupStore((state) => state.cloudProblem)
    const busy = useBackupStore((state) => state.phase !== 'idle')
    const openCloudSetup = useBackupStore((state) => state.openCloudSetup)
    const backUpToCloudNow = useBackupStore((state) => state.backUpToCloudNow)
    const openCloudRestore = useBackupStore((state) => state.openCloudRestore)
    const turnOffCloud = useBackupStore((state) => state.turnOffCloud)
    const setCloudAuto = useBackupStore((state) => state.setCloudAuto)
    const service = findCloudService(cloud.service)

    return (
        <>
            <h3 className="settings__group">Cloud backup</h3>
            {service ? (
                <>
                    <SettingRow label={service.label} help={`${cloud.bucket}/${cloud.folder ? `${cloud.folder}/` : ''}`}>
                        <button type="button" className="text-button" onClick={() => void turnOffCloud()}>
                            Turn off
                        </button>
                        <button type="button" className="button" disabled={busy} onClick={openCloudSetup}>
                            Change…
                        </button>
                    </SettingRow>
                    <SettingRow label="Last backed up" help={problem ?? (cloud.lastAt ? lastBackupLabel(cloud.lastAt) : 'Not yet.')}>
                        {problem ? <span className="setting__warning">Not backed up</span> : null}
                        <button type="button" className="button" disabled={busy} onClick={() => void backUpToCloudNow()}>
                            Back up now
                        </button>
                    </SettingRow>
                    <SettingRow
                        label="Back up automatically"
                        help="A minute after you save, when the app starts, and when it closes. Only what changed goes up, and nothing when nothing did."
                    >
                        <Switch label="Back up automatically" value={cloud.auto} onChange={setCloudAuto} />
                    </SettingRow>
                    <SettingRow label="Restore from the cloud" help="Shows what's in the cloud backup first, including anything removed since. Nothing replaces what you have.">
                        <button type="button" className="button" disabled={busy} onClick={() => void openCloudRestore()}>
                            Restore from the cloud…
                        </button>
                    </SettingRow>
                </>
            ) : (
                <SettingRow
                    label="Back up to the cloud"
                    help="To storage you already have: Cloudflare R2, Backblaze B2, Amazon S3, Wasabi, or any storage that speaks the S3 API. Only what changed goes up."
                >
                    <button type="button" className="button" disabled={busy} onClick={openCloudSetup}>
                        Set up…
                    </button>
                </SettingRow>
            )}
        </>
    )
}

/** Backing up to a file, to a folder by itself, and to the cloud; and restoring from each. */
export function BackupSettings() {
    const phase = useBackupStore((state) => state.phase)
    const progress = useBackupStore((state) => state.progress)
    const backUp = useBackupStore((state) => state.backUp)
    const openRestore = useBackupStore((state) => state.openRestore)
    const stop = useBackupStore((state) => state.stop)
    const busy = phase !== 'idle'

    if (!canBackUp()) {
        return <p className="settings__intro">Backups need the desktop app.</p>
    }

    return (
        <>
            <p className="settings__intro">
                A backup is one .zip file holding everything you saved, with its pictures. Keep it on a USB stick or in a
                synced folder, and bring your work back on any computer.
            </p>
            <SettingRow label="Back up to a file" help="Saves a .zip of your work wherever you choose. Exported files aren't included, since they can be made again.">
                <button type="button" className="button" disabled={busy} onClick={() => void backUp()}>
                    Back up to a file…
                </button>
            </SettingRow>
            <SettingRow label="Restore from a backup" help="Shows what's in a backup first. Nothing replaces what you have.">
                <button type="button" className="button" disabled={busy} onClick={() => void openRestore()}>
                    Restore from a backup…
                </button>
            </SettingRow>
            <FolderBackupRows />
            <CloudBackupRows />
            {busy ? (
                <div className="backup-progress" role="status">
                    <span className="setting__help">
                        {phase === 'backing-up' ? 'Backing up' : phase === 'opening' ? 'Opening the backup' : 'Restoring'}
                        {progress ? `, ${progress.done} of ${progress.total} files` : '…'}
                    </span>
                    <progress className="dialog__progress" max={progress?.total ?? 1} value={progress?.done ?? 0} aria-label="Files done" />
                    <button type="button" className="button" onClick={stop}>
                        Stop
                    </button>
                </div>
            ) : null}
        </>
    )
}
