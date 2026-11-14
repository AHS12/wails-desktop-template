/**
 * Home: start something new, open a file, pick up a draft, or go back to a recent
 * document. A start page, so it shows one row of recent work and links to the rest.
 */

import {ChevronRight, FilePlus, FolderOpen, Pencil, RotateCcw, Trash2} from 'lucide-react'
import {useEffect, useLayoutEffect, useRef, useState} from 'react'
import {APP} from '../../core/app'
import {guardUnsaved} from '../commands'
import {canUndo} from '../../core/history/history'
import {features} from '../feature'
import type {SavedDocument} from '../../platform/documents'
import {documentType, useDocumentStore} from '../../store/document-store'
import {displayName, savedLabel} from './document-labels'
import {DocumentPicture} from './document-tile'

/** The most recent documents Home shows, if that many fit across. */
const RECENT_MOST = 6

interface CardProps {
    readonly document: SavedDocument
    readonly current: boolean
    onOpen(): void
    onRemove(): void
    onRename(name: string): void
}

/** One saved document. The body opens it; the actions are siblings, not nested buttons. */
function DocumentCard({document, current, onOpen, onRemove, onRename}: CardProps) {
    const name = displayName(document)
    const [renaming, setRenaming] = useState(false)
    const [draft, setDraft] = useState(name)

    const commitRename = () => {
        setRenaming(false)

        if (draft.trim() !== '' && draft.trim() !== name) {
            onRename(draft.trim())
        }
    }

    if (renaming) {
        return (
            <li className="document-tile" data-current={current}>
                <div className="document-tile__panel">
                    <label className="dialog__label" htmlFor={`rename-${document.id}`}>
                        New name for {name}
                    </label>
                    <input
                        className="field"
                        id={`rename-${document.id}`}
                        value={draft}
                        maxLength={60}
                        autoFocus
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault()
                                commitRename()
                            } else if (event.key === 'Escape') {
                                event.preventDefault()
                                setRenaming(false)
                            }
                        }}
                    />
                    <div className="document-tile__choices">
                        <button type="button" className="button" onClick={() => setRenaming(false)}>
                            Cancel
                        </button>
                        <button type="button" className="button button--primary" onClick={commitRename}>
                            Rename
                        </button>
                    </div>
                </div>
            </li>
        )
    }

    return (
        <li className="document-tile" data-current={current}>
            <button type="button" className="document-tile__open" title={name} onClick={onOpen}>
                <span className="document-tile__thumb">
                    <DocumentPicture document={document} />
                </span>
                <span className="document-tile__name">{name}</span>
                <span className="document-tile__meta">
                    {savedLabel(document.savedAt)}
                    {current ? <span className="document-tile__badge">Editing</span> : null}
                </span>
            </button>
            <div className="document-tile__actions">
                <button
                    type="button"
                    className="icon-button icon-button--overlay"
                    aria-label={`Rename ${name}`}
                    title="Rename"
                    onClick={() => {
                        setDraft(name)
                        setRenaming(true)
                    }}
                >
                    <Pencil size={12} aria-hidden="true" />
                </button>
                <button type="button" className="icon-button icon-button--overlay" aria-label={`Remove ${name}`} title="Remove" onClick={onRemove}>
                    <Trash2 size={12} aria-hidden="true" />
                </button>
            </div>
        </li>
    )
}

export function HomePage() {
    const documents = useDocumentStore((state) => state.documents)
    const loading = useDocumentStore((state) => state.documentsLoading)
    const refreshDocuments = useDocumentStore((state) => state.refreshDocuments)
    const draftAvailable = useDocumentStore((state) => state.draftAvailable)
    const refreshDraft = useDocumentStore((state) => state.refreshDraft)
    const restoreDraft = useDocumentStore((state) => state.restoreDraft)
    const discardDraft = useDocumentStore((state) => state.discardDraft)
    const currentId = useDocumentStore((state) => state.currentId)
    const open = useDocumentStore((state) => state.open)
    const rename = useDocumentStore((state) => state.rename)
    const remove = useDocumentStore((state) => state.remove)
    const showEditor = useDocumentStore((state) => state.showEditor)
    const showDocuments = useDocumentStore((state) => state.showDocuments)
    const name = useDocumentStore((state) => state.name)
    const history = useDocumentStore((state) => state.history)
    const documentInHand = useDocumentStore((state) => state.documentInHand)
    const plural = `${documentType.noun}s`

    const [perRow, setPerRow] = useState(RECENT_MOST)
    const recentList = useRef<HTMLDivElement>(null)

    useEffect(() => {
        void refreshDocuments()
        void refreshDraft()
    }, [refreshDocuments, refreshDraft])

    const hasDocuments = documents.length > 0

    // One row of the latest saves, as many as fit across, so Home stays a start page.
    useLayoutEffect(() => {
        const list = recentList.current

        if (!list) {
            return
        }

        // The grid fills the row with as many columns as fit, whether or not there are
        // tiles for them, so its column count is the answer at any interface scale.
        const measure = () => {
            const grid = list.querySelector('.tile-grid')
            const across = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : RECENT_MOST

            setPerRow(Math.max(1, Math.min(RECENT_MOST, across)))
        }

        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(list)

        return () => observer.disconnect()
    }, [hasDocuments])

    // Only something opened or changed in this session is worth going back to.
    const inHand = documentInHand || canUndo(history)
    const store = useDocumentStore.getState

    return (
        <main className="home">
            <div className="home__inner">
                <header className="home__head">
                    <div>
                        <h1 className="home__title">{APP.name}</h1>
                        <p className="home__sub">Start a new {documentType.noun}, or pick up one you saved.</p>
                    </div>
                    {inHand ? (
                        <button type="button" className="button" onClick={showEditor}>
                            <RotateCcw size={13} aria-hidden="true" />
                            Back to “{name}”
                        </button>
                    ) : null}
                </header>

                {draftAvailable ? (
                    <section className="home__draft" data-coach="home-draft">
                        <div>
                            <h2 className="home__draft-title">You left some work unsaved</h2>
                            <p className="dialog__hint">The app closed before you saved. Pick it up, or let it go.</p>
                        </div>
                        <div className="home__draft-actions">
                            <button type="button" className="button" onClick={() => void discardDraft()}>
                                Discard it
                            </button>
                            <button type="button" className="button button--primary" onClick={() => void restoreDraft()}>
                                Pick up where I left off
                            </button>
                        </div>
                    </section>
                ) : null}

                <section className="home__section" aria-label="Start" data-coach="home-start">
                    <div className="home__start">
                        <button
                            type="button"
                            className="button button--primary"
                            onClick={() => guardUnsaved(store(), `Start a new ${documentType.noun}`, () => store().startNew())}
                        >
                            <FilePlus size={14} aria-hidden="true" />
                            New {documentType.noun}
                        </button>
                        <button type="button" className="button" onClick={() => guardUnsaved(store(), 'Open a file', () => void store().openFromFile())}>
                            <FolderOpen size={14} aria-hidden="true" />
                            Open a file…
                        </button>
                    </div>
                </section>

                <section className="home__section" aria-label={`Recent ${plural}`} data-coach="home-recent">
                    <div className="home__section-head">
                        <h2 className="home__section-title">Recent {plural}</h2>
                        {hasDocuments ? (
                            <button type="button" className="button" onClick={showDocuments}>
                                All your {plural} ({documents.length})
                                <ChevronRight size={13} aria-hidden="true" />
                            </button>
                        ) : null}
                    </div>

                    {loading && !hasDocuments ? (
                        <p className="dialog__hint" role="status">
                            Looking for your {plural}…
                        </p>
                    ) : !hasDocuments ? (
                        <div className="home__empty">
                            <p className="dialog__hint">What you save shows up here.</p>
                            {features().map(({id, HomeEmpty}) => (HomeEmpty ? <HomeEmpty key={id} /> : null))}
                        </div>
                    ) : (
                        <div ref={recentList}>
                            <ul className="tile-grid">
                                {documents.slice(0, perRow).map((document) => (
                                    <DocumentCard
                                        key={document.id}
                                        document={document}
                                        current={document.id === currentId}
                                        onOpen={() => guardUnsaved(store(), `Open “${displayName(document)}”`, () => void open(document.id))}
                                        onRemove={() => void remove([document.id])}
                                        onRename={(next) => void rename(document.id, next)}
                                    />
                                ))}
                            </ul>
                        </div>
                    )}
                </section>
            </div>
        </main>
    )
}
