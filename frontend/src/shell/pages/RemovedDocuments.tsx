/**
 * Recently removed: documents waiting until they're put back or 30 days go by.
 *
 * Shown on the library page as tiles, and in Settings as rows, with the same actions:
 * put one back, remove one for good, or all of them at once. Only removing for
 * good asks first, since it's the one thing here that can't be undone.
 */

import {RotateCcw, Trash2} from 'lucide-react'
import {useEffect, useState} from 'react'
import type {RemovedDocument} from '../../platform/documents'
import {documentType, useDocumentStore} from '../../store/document-store'
import {displayName, savedLabel} from './document-labels'
import {DocumentPicture} from './document-tile'

/** What's waiting to be confirmed: one document by id, or all of them. */
type Forgetting = string | 'all' | null

function ForgetQuestion({label, onKeep, onForget}: {label: string; onKeep(): void; onForget(): void}) {
    return (
        <div className="removed-documents__question" role="group" aria-label={label}>
            <p className="dialog__hint">{label} This can't be undone.</p>
            <div className="document-tile__choices">
                <button type="button" className="button" autoFocus onClick={onKeep}>
                    Keep it
                </button>
                <button type="button" className="button button--danger" onClick={onForget}>
                    Remove for good
                </button>
            </div>
        </div>
    )
}

function Actions({document, forgetting, setForgetting}: {document: RemovedDocument; forgetting: Forgetting; setForgetting(next: Forgetting): void}) {
    const putBack = useDocumentStore((state) => state.putBack)
    const forget = useDocumentStore((state) => state.forget)
    const name = displayName(document)

    return forgetting === document.id ? (
        <ForgetQuestion
            label={`Remove “${name}” for good?`}
            onKeep={() => setForgetting(null)}
            onForget={() => {
                setForgetting(null)
                void forget(document.id)
            }}
        />
    ) : (
        <div className="document-tile__choices removed-documents__actions">
            <button type="button" className="button" aria-label={`Put back ${name}`} onClick={() => void putBack([document.id])}>
                <RotateCcw size={13} aria-hidden="true" />
                Put back
            </button>
            <button type="button" className="button" aria-label={`Remove ${name} for good`} onClick={() => setForgetting(document.id)}>
                Remove for good
            </button>
        </div>
    )
}

export function RemovedDocuments({layout}: {layout: 'tiles' | 'rows'}) {
    const removed = useDocumentStore((state) => state.removed)
    const refreshRemoved = useDocumentStore((state) => state.refreshRemoved)
    const putBack = useDocumentStore((state) => state.putBack)
    const forgetAllRemoved = useDocumentStore((state) => state.forgetAllRemoved)
    const [forgetting, setForgetting] = useState<Forgetting>(null)

    useEffect(() => {
        void refreshRemoved()
    }, [refreshRemoved])

    return (
        <div className="removed-documents" data-layout={layout}>
            <p className="dialog__hint">Removed {documentType.noun}s wait here for 30 days, then they're gone for good.</p>

            {removed.length === 0 ? (
                <p className="dialog__hint">Nothing here.</p>
            ) : (
                <>
                    {removed.length > 1 ? (
                        forgetting === 'all' ? (
                            <ForgetQuestion
                                label={`Remove all ${removed.length} ${documentType.noun}s for good?`}
                                onKeep={() => setForgetting(null)}
                                onForget={() => {
                                    setForgetting(null)
                                    void forgetAllRemoved()
                                }}
                            />
                        ) : (
                            <div className="removed-documents__all">
                                <button type="button" className="button" onClick={() => void putBack(removed.map((document) => document.id))}>
                                    <RotateCcw size={13} aria-hidden="true" />
                                    Put all back
                                </button>
                                <button type="button" className="button" onClick={() => setForgetting('all')}>
                                    <Trash2 size={13} aria-hidden="true" />
                                    Remove all for good
                                </button>
                            </div>
                        )
                    ) : null}

                    {layout === 'tiles' ? (
                        <ul className="tile-grid library-page__grid">
                            {removed.map((document) => (
                                <li key={document.id} className="document-tile">
                                    <div className="document-tile__thumb">
                                        <DocumentPicture document={document} />
                                    </div>
                                    <span className="document-tile__name">{displayName(document)}</span>
                                    <span className="document-tile__meta">Removed {savedLabel(document.removedAt)}</span>
                                    <Actions document={document} forgetting={forgetting} setForgetting={setForgetting} />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <ul className="removed-documents__rows">
                            {removed.map((document) => (
                                <li key={document.id} className="removed-documents__row">
                                    <span className="removed-documents__thumb">
                                        <DocumentPicture document={document} iconSize={18} />
                                    </span>
                                    <span className="removed-documents__text">
                                        <span className="setting__label">{displayName(document)}</span>
                                        <span className="setting__help">Removed {savedLabel(document.removedAt)}</span>
                                    </span>
                                    <Actions document={document} forgetting={forgetting} setForgetting={setForgetting} />
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    )
}
