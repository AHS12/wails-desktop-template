/** The library page's Export… for the picked document, or every ticked one. */

import {Download} from 'lucide-react'
import {useExportStore} from './export-store'

export function ExportButton({ids}: {readonly ids: readonly string[]}) {
    return (
        <button type="button" className="button" title="Export without opening" onClick={() => useExportStore.getState().openMany(ids)}>
            <Download size={13} aria-hidden="true" />
            Export…
        </button>
    )
}
