/** What both export dialogs ask: which formats, and which folder. */

import {FolderOpen} from 'lucide-react'
import {chooseFolder} from '../../platform/desktop'
import type {Content} from '../../store/document-store'
import type {ExportFormat} from './formats'
import {writesToFolders} from './platform'

export function FormatChoices({
    formats,
    chosen,
    onChange,
}: {
    formats: readonly ExportFormat<Content>[]
    chosen: readonly string[]
    onChange(next: readonly string[]): void
}) {
    return (
        <fieldset className="export__formats">
            <legend className="dialog__label">Save as</legend>
            {formats.map((format) => (
                <label key={format.id} className="export__format">
                    <input
                        type="checkbox"
                        checked={chosen.includes(format.id)}
                        onChange={(event) =>
                            onChange(event.target.checked ? [...chosen, format.id] : chosen.filter((id) => id !== format.id))
                        }
                    />
                    <span>
                        <span>
                            {format.label} <span className="export__extension">.{format.extension}</span>
                        </span>
                        {format.help ? <span className="dialog__hint export__help">{format.help}</span> : null}
                    </span>
                </label>
            ))}
        </fieldset>
    )
}

export function FolderChoice({folder, onChange}: {folder: string; onChange(folder: string): void}) {
    if (!writesToFolders()) {
        return <p className="dialog__hint">In a browser, each file is downloaded.</p>
    }

    return (
        <div className="export__folder">
            <span className="dialog__label">Folder</span>
            <span className="export__path" title={folder}>
                {folder || 'Not chosen yet'}
            </span>
            <button
                type="button"
                className="button"
                onClick={() => void chooseFolder(folder, 'Export to this folder').then((chosen) => chosen && onChange(chosen))}
            >
                <FolderOpen size={13} aria-hidden="true" />
                {folder ? 'Change…' : 'Choose…'}
            </button>
        </div>
    )
}
