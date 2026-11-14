import {X} from 'lucide-react'
import {useEffect} from 'react'
import {isDesktop, showFolder} from '../platform/desktop'
import {useDocumentStore} from '../store/document-store'

/**
 * A short message with an action.
 *
 * Used for things the user should know about but should not be interrupted
 * by, such as a removal that can be undone.
 */
export function Toast() {
    const toast = useDocumentStore((state) => state.toast)
    const dismissToast = useDocumentStore((state) => state.dismissToast)
    const undo = useDocumentStore((state) => state.undo)
    const notify = useDocumentStore((state) => state.notify)

    useEffect(() => {
        if (!toast) {
            return
        }

        const timer = window.setTimeout(dismissToast, 6000)

        return () => window.clearTimeout(timer)
    }, [toast, dismissToast])

    if (!toast) {
        return null
    }

    return (
        <div className="notice" role="status">
            <span className="notice__message">{toast.message}</span>

            {toast.undoable ? (
                <button
                    type="button"
                    className="notice__action"
                    onClick={() => {
                        undo()
                        dismissToast()
                    }}
                >
                    Undo
                </button>
            ) : null}

            {toast.action ? (
                <button
                    type="button"
                    className="notice__action"
                    onClick={() => {
                        dismissToast()
                        toast.action!.run()
                    }}
                >
                    {toast.action.label}
                </button>
            ) : null}

            {toast.folder && isDesktop() ? (
                <button
                    type="button"
                    className="notice__action"
                    onClick={() => {
                        const folder = toast.folder!

                        dismissToast()
                        showFolder(folder).catch(() =>
                            notify("Couldn't open the folder. It may have been moved or removed."),
                        )
                    }}
                >
                    Show the files
                </button>
            ) : null}

            <button
                type="button"
                className="notice__close"
                onClick={dismissToast}
                aria-label="Dismiss"
            >
                <X size={13} aria-hidden="true" />
            </button>
        </div>
    )
}
