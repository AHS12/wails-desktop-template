/** The library page's line saying whether a document is in the cloud backup as it is now. */

import {useEffect, useState} from 'react'
import type {SavedDocument} from '../../platform/documents'
import {useSettingsStore} from '../../store/settings-store'
import {cloudTargetOf} from './backup-store'
import {cloudDocumentStatus, type CloudDocumentStatus} from './platform'

const BACKUP_LABELS: Readonly<Record<CloudDocumentStatus, string>> = {
    'backed-up': 'Backed up to the cloud',
    changed: 'Changed since the last backup',
    'not-yet': 'Not backed up yet',
}

/**
 * Whether the document is in the cloud backup as it is now, or null when there's no
 * cloud backup to ask about. Asked again when it's saved or a backup ends.
 */
function useCloudStatus(document: SavedDocument): CloudDocumentStatus | null {
    const cloud = useSettingsStore((state) => state.cloudBackup)
    const [status, setStatus] = useState<CloudDocumentStatus | null>(null)
    const readable = document.kind !== null

    useEffect(() => {
        let current = true

        if (!cloud.service || !readable) {
            setStatus(null)
            return
        }

        void cloudDocumentStatus(cloudTargetOf(cloud), document.id).then(
            (next) => current && setStatus(next),
            () => current && setStatus(null),
        )

        return () => {
            current = false
        }
        // The target, the document's save and the last backup are what can change the answer.
    }, [cloud, document.id, document.savedAt, readable])

    return status
}

export function CloudStatusFacts({document}: {readonly document: SavedDocument}) {
    const backup = useCloudStatus(document)

    return backup ? (
        <>
            <dt>Backup</dt>
            <dd data-backup={backup}>{BACKUP_LABELS[backup]}</dd>
        </>
    ) : null
}
