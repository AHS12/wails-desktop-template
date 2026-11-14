/**
 * The example app's editor: one note, as plain text.
 *
 * Typing changes the note at once, and each burst of typing becomes one step to undo
 * once it pauses, so Undo takes back a phrase rather than a letter.
 */

import {useEffect, useRef} from 'react'
import {useDocumentStore} from '../store/document-store'
import type {Note} from './note'

/** How long typing has to pause before it counts as one step to undo. */
const TYPING_STEP_MS = 800

export function NoteEditor() {
    const text = useDocumentStore((state) => state.content.text)
    const before = useRef<Note | null>(null)
    const timer = useRef<number | undefined>(undefined)

    const commit = () => {
        window.clearTimeout(timer.current)

        if (before.current) {
            useDocumentStore.getState().commitEdit('typing', before.current)
            before.current = null
        }
    }

    // Leaving the editor finishes the step, so Undo on another page still has it.
    useEffect(() => commit, [])

    return (
        <main className="note-editor" data-coach="editor">
            <textarea
                className="note-editor__text"
                aria-label="Note"
                placeholder="Start typing…"
                spellCheck
                value={text}
                onChange={(event) => {
                    const store = useDocumentStore.getState()

                    before.current ??= store.content
                    store.previewEdit({...store.content, text: event.target.value})
                    window.clearTimeout(timer.current)
                    timer.current = window.setTimeout(commit, TYPING_STEP_MS)
                }}
                onBlur={commit}
                onKeyDown={(event) => {
                    const key = event.key.toLowerCase()

                    if (!(event.ctrlKey || event.metaKey) || (key !== 'z' && key !== 'y')) {
                        return
                    }

                    // The document's history, not the browser's, which knows nothing of saving or
                    // drafts. Finishing the step first means Undo takes back the words just typed.
                    event.preventDefault()
                    commit()

                    const store = useDocumentStore.getState()

                    if (key === 'y' || event.shiftKey) {
                        store.redo()
                    } else {
                        store.undo()
                    }
                }}
            />
        </main>
    )
}
