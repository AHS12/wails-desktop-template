/**
 * What's in a backup, before anything comes in.
 *
 * Documents new to this computer are ticked. One that differs from the one saved
 * here is ticked too, and comes in as a second copy, never over yours. One that
 * is already here, byte for byte, is shown greyed and skipped.
 */

import {Check} from 'lucide-react'
import {useEffect, useMemo, useState} from 'react'
import {Dialog} from '../../components/controls'
import {FROM_BACKUP} from './restore-plan'
import {APP} from '../../core/app'
import {DOCUMENT_ICON, displayName, savedLabel} from '../../shell/pages/document-labels'
import {useBackupStore, type HeldDocumentView} from './backup-store'
import {documentType} from '../../store/document-store'

const GROUPS = [
    {status: 'new', title: 'New to this computer', hint: null},
    {status: 'different', title: 'Different from the one here', hint: `Comes in as a second copy, “… ${FROM_BACKUP}”. Yours stays as it is.`},
    {status: 'removed', title: 'Removed since', hint: 'Removed on a computer after they were backed up. Tick any you want back.'},
] as const

const madeLabel = (iso: string): string => {
    const date = new Date(iso)

    return Number.isNaN(date.getTime())
        ? ''
        : new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'}).format(date)
}

function HeldTile({held, ticked, onToggle}: {held: HeldDocumentView; ticked: boolean; onToggle(): void}) {
    const Icon = DOCUMENT_ICON
    const name = displayName(held)

    return (
        <li className="document-tile" data-ticked={ticked}>
            <button type="button" className="document-tile__open" role="checkbox" aria-checked={ticked} aria-label={name} onClick={onToggle}>
                <span className="document-tile__thumb">
                    {held.picture ? <img src={held.picture} alt="" draggable={false} loading="lazy" /> : <Icon size={30} aria-hidden="true" />}
                </span>
                <span className="document-tile__name">{name}</span>
                <span className="document-tile__meta">Saved {savedLabel(held.savedAt)}</span>
            </button>
            <span className="document-tile__tick restore__tick" aria-hidden="true">
                {ticked ? <Check size={12} /> : null}
            </span>
        </li>
    )
}

export function RestoreDialog() {
    const restoring = useBackupStore((state) => state.restoring)
    const phase = useBackupStore((state) => state.phase)
    const progress = useBackupStore((state) => state.progress)
    const restore = useBackupStore((state) => state.restore)
    const cancelRestore = useBackupStore((state) => state.cancelRestore)
    const stop = useBackupStore((state) => state.stop)
    const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())

    const documents = useMemo(() => restoring?.documents ?? [], [restoring])
    const plural = `${documentType.noun}s`

    // A fresh backup starts with everything worth bringing in ticked. Removed ones were removed on purpose, so they wait to be asked for.
    useEffect(() => {
        setTicked(new Set(documents.filter((held) => held.status === 'new' || held.status === 'different').map((held) => held.id)))
    }, [documents])

    const toggle = (id: string) => {
        const next = new Set(ticked)

        if (!next.delete(id)) {
            next.add(id)
        }

        setTicked(next)
    }

    const same = documents.filter((held) => held.status === 'same').length
    const chosen = documents.filter((held) => held.status !== 'same' && ticked.has(held.id)).length
    const busy = phase === 'restoring'
    const nothingNew = documents.length === same

    return (
        <Dialog
            open={restoring !== null}
            onClose={() => (busy ? undefined : void cancelRestore())}
            title="Restore from a backup"
            width={760}
            closesOnOutsideClick={false}
        >
            <div className="dialog__form restore">
                <p className="dialog__hint">
                    {restoring?.backup.madeAt ? `Made ${madeLabel(restoring.backup.madeAt)}` : 'A backup'}
                    {restoring?.backup.app ? ` with ${APP.name} ${restoring.backup.app}` : ''}. Nothing here replaces what you have.
                </p>

                <div className="restore__groups">
                    {GROUPS.map(({status, title, hint}) => {
                        const inGroup = documents.filter((held) => held.status === status)

                        return inGroup.length === 0 ? null : (
                            <section key={status} aria-label={title}>
                                <h3 className="settings__group">
                                    {title} ({inGroup.length})
                                </h3>
                                {hint ? <p className="dialog__hint">{hint}</p> : null}
                                <ul className="tile-grid restore__grid">
                                    {inGroup.map((held) => (
                                        <HeldTile key={held.id} held={held} ticked={ticked.has(held.id)} onToggle={() => toggle(held.id)} />
                                    ))}
                                </ul>
                            </section>
                        )
                    })}

                    {same > 0 ? (
                        <p className="dialog__hint">
                            {same === 1 ? `1 ${documentType.noun} is` : `${same} ${plural} are`} already here, exactly as in the backup, so {same === 1 ? 'it' : 'they'} will be left alone.
                        </p>
                    ) : null}
                    {documents.length === 0 ? <p className="dialog__hint">This backup is empty.</p> : null}
                </div>

                {busy ? (
                    <progress
                        className="dialog__progress"
                        max={progress?.total ?? 1}
                        value={progress?.done ?? 0}
                        aria-label="Restored so far"
                    />
                ) : null}

                <div className="dialog__actions">
                    {busy ? (
                        <button type="button" className="button" onClick={stop}>
                            Stop
                        </button>
                    ) : (
                        <button type="button" className="button" onClick={() => void cancelRestore()}>
                            Cancel
                        </button>
                    )}
                    {nothingNew ? null : (
                        <button
                            type="button"
                            className="button button--primary"
                            disabled={busy || chosen === 0}
                            onClick={() => void restore(ticked)}
                        >
                            {chosen === 1 ? `Restore 1 ${documentType.noun}` : `Restore ${chosen} ${plural}`}
                        </button>
                    )}
                </div>
            </div>
        </Dialog>
    )
}
