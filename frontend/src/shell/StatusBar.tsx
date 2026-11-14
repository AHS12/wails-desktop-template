/**
 * The status bar. On the left, what you can do right now. On the right, whether the
 * document is saved.
 */

import {shortcutFor} from './commands'
import {hasUnsavedChanges, useDocumentStore} from '../store/document-store'
import {useSettingsStore} from '../store/settings-store'
import {hintFor} from './status-hint'

export function StatusBar() {
    const dirty = useDocumentStore(hasUnsavedChanges)
    // A new document has nothing to lose yet, but it isn't saved anywhere either.
    const neverSaved = useDocumentStore((state) => state.currentId === null && state.filePath === null)
    // Read so the hint follows a shortcut changed in Settings.
    useSettingsStore((state) => state.shortcuts)

    return (
        <footer className="statusbar" data-coach="status">
            <span className="statusbar__hint" role="status">
                {hintFor({save: shortcutFor('save'), palette: shortcutFor('palette')})}
            </span>
            <span className="statusbar__right">
                <span>{dirty ? 'Unsaved' : neverSaved ? 'Not saved yet' : 'Saved'}</span>
            </span>
        </footer>
    )
}
