/**
 * Every saved document, in the manner of a file browser with a preview: a grid to
 * find one, and a panel beside it saying what it is, with what can be done to it
 * without opening it.
 *
 * Removing moves a document to Recently removed, so nothing here asks first: Undo is
 * in the message, and Recently removed at the end of the list puts anything back.
 */

import {ArrowLeft, Check, Copy, FolderOpen, Pencil, Search, Trash2, X} from 'lucide-react'
import {useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent} from 'react'
import {Select} from '../../components/controls'
import {APP} from '../../core/app'
import {groupByTime, matchesSearch, sortDocuments, type DocumentSort} from '../../core/library/document-summary'
import type {SavedDocument} from '../../platform/documents'
import {features} from '../feature'
import {documentType, useDocumentStore} from '../../store/document-store'
import {useSettingsStore} from '../../store/settings-store'
import {displayName, savedLabel} from './document-labels'
import {DocumentPicture} from './document-tile'
import {RemovedDocuments} from './RemovedDocuments'

const SORTS: readonly {value: DocumentSort; label: string}[] = [
    {value: 'changed', label: 'Last changed'},
    {value: 'name', label: 'Name'},
    {value: 'made', label: 'Date made'},
]

/** F2 asking the panel to rename. `at` makes each press new. */
interface RenameRequest {
    readonly at: number
}

const dateLabel = (iso: string | null): string | null => {
    const date = iso ? new Date(iso) : null

    return date && !Number.isNaN(date.getTime())
        ? new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'short', year: 'numeric'}).format(date)
        : null
}

const sizeLabel = (bytes: number): string =>
    bytes < 1024 ? `${bytes} bytes` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

/** What features offer to do with the picked or ticked documents, such as Export. */
function FeatureActions({ids}: {ids: readonly string[]}) {
    return (
        <>
            {features().map(({id, DocumentActions}) => (DocumentActions ? <DocumentActions key={id} ids={ids} /> : null))}
        </>
    )
}

/** How many tiles sit across the grid, so Up and Down move by a row. */
function columnsOf(grid: Element | null): number {
    if (!grid) {
        return 1
    }

    return Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length)
}

function Details({document, editing, request}: {document: SavedDocument; editing: boolean; request: RenameRequest | null}) {
    const open = useDocumentStore((state) => state.open)
    const rename = useDocumentStore((state) => state.rename)
    const remove = useDocumentStore((state) => state.remove)
    const copy = useDocumentStore((state) => state.copy)
    const showFile = useDocumentStore((state) => state.showFile)

    const name = displayName(document)
    const [renaming, setRenaming] = useState(false)
    const [draft, setDraft] = useState(name)

    // Picking another document puts the panel back as it was.
    useEffect(() => {
        setRenaming(false)
    }, [document.id])

    useEffect(() => {
        if (request) {
            setDraft(name)
            setRenaming(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per request.
    }, [request])

    const commitRename = () => {
        setRenaming(false)

        if (draft.trim() !== '' && draft.trim() !== name) {
            void rename(document.id, draft.trim())
        }
    }

    const made = dateLabel(document.createdAt)
    const readable = document.kind !== null

    return (
        <aside className="library-page__details" aria-label={`About ${name}`}>
            <div className="library-page__preview">
                <DocumentPicture document={document} iconSize={48} />
            </div>

            {renaming ? (
                <div className="library-page__rename">
                    <label className="dialog__label" htmlFor="library-rename">
                        New name
                    </label>
                    <input
                        className="field"
                        id="library-rename"
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
                                event.stopPropagation()
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
            ) : (
                <h2 className="library-page__name">
                    {name}
                    {editing ? <span className="document-tile__badge">Editing</span> : null}
                </h2>
            )}

            <dl className="library-page__facts">
                {made ? (
                    <>
                        <dt>Made</dt>
                        <dd>{made}</dd>
                    </>
                ) : null}
                <dt>Changed</dt>
                <dd>{savedLabel(document.savedAt)}</dd>
                <dt>Size</dt>
                <dd>{sizeLabel(document.size)}</dd>
                {features().map(({id, DocumentFacts}) => (DocumentFacts ? <DocumentFacts key={id} document={document} /> : null))}
            </dl>

            {readable ? null : (
                <p className="dialog__hint">This file can't be read. It may be damaged, or from a newer {APP.name}.</p>
            )}

            <div className="library-page__actions">
                <div className="library-page__main-actions">
                    <button type="button" className="button button--primary" disabled={!readable} onClick={() => void open(document.id)}>
                        Open
                    </button>
                    {readable ? <FeatureActions ids={[document.id]} /> : null}
                </div>
                <div className="library-page__more-actions">
                    <button type="button" className="button" disabled={!readable} onClick={() => void copy(document.id)}>
                        <Copy size={13} aria-hidden="true" />
                        Copy
                    </button>
                    <button
                        type="button"
                        className="button"
                        onClick={() => {
                            setDraft(name)
                            setRenaming(true)
                        }}
                    >
                        <Pencil size={13} aria-hidden="true" />
                        Rename
                    </button>
                    <button type="button" className="button" onClick={() => void showFile(document.id)}>
                        <FolderOpen size={13} aria-hidden="true" />
                        Show in folder
                    </button>
                    <button type="button" className="button" onClick={() => void remove([document.id])}>
                        <Trash2 size={13} aria-hidden="true" />
                        Remove
                    </button>
                </div>
            </div>
        </aside>
    )
}

/** The panel while several documents are ticked: what can be done to all of them at once. */
function TickedDetails({ids, onClear}: {ids: readonly string[]; onClear(): void}) {
    const remove = useDocumentStore((state) => state.remove)
    const plural = `${ids.length} ${documentType.noun}s`

    return (
        <aside className="library-page__details" aria-label={`${plural} ticked`}>
            <h2 className="library-page__name">{plural}</h2>
            <p className="dialog__hint">Ctrl-click to tick or untick one more, Shift-click for a run. Esc clears the ticks.</p>
            <div className="library-page__actions">
                <div className="library-page__main-actions">
                    <FeatureActions ids={ids} />
                    <button
                        type="button"
                        className="button"
                        onClick={() => {
                            onClear()
                            void remove(ids)
                        }}
                    >
                        <Trash2 size={13} aria-hidden="true" />
                        Remove
                    </button>
                </div>
                <button type="button" className="button" onClick={onClear}>
                    Clear the ticks
                </button>
            </div>
        </aside>
    )
}

/** Recently removed, in place of the list, with a way back. */
function Removed({onBack}: {onBack(): void}) {
    return (
        <section className="library-page__bin" aria-label="Recently removed">
            <div className="home__section-head">
                <h2 className="home__section-title">Recently removed</h2>
                <button type="button" className="button" onClick={onBack}>
                    Back to your {documentType.noun}s
                </button>
            </div>
            <RemovedDocuments layout="tiles" />
        </section>
    )
}

export function DocumentsPage() {
    const documents = useDocumentStore((state) => state.documents)
    const loading = useDocumentStore((state) => state.documentsLoading)
    const refreshDocuments = useDocumentStore((state) => state.refreshDocuments)
    const removed = useDocumentStore((state) => state.removed)
    const refreshRemoved = useDocumentStore((state) => state.refreshRemoved)
    const currentId = useDocumentStore((state) => state.currentId)
    const pickedId = useDocumentStore((state) => state.pickedId)
    const pick = useDocumentStore((state) => state.pick)
    const open = useDocumentStore((state) => state.open)
    const remove = useDocumentStore((state) => state.remove)
    const showHome = useDocumentStore((state) => state.showHome)
    const sort = useSettingsStore((state) => state.documentsSort)
    const setSort = useSettingsStore((state) => state.setDocumentsSort)
    const plural = `${documentType.noun}s`

    const [search, setSearch] = useState('')
    const [request, setRequest] = useState<RenameRequest | null>(null)
    const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())
    const [inRemoved, setInRemoved] = useState(false)
    const searchField = useRef<HTMLInputElement>(null)
    const grid = useRef<HTMLDivElement>(null)

    useEffect(() => {
        void refreshDocuments()
        void refreshRemoved()
    }, [refreshDocuments, refreshRemoved])

    // A tick on a document that's gone, by Remove or Undo, means nothing.
    useEffect(() => {
        setTicked((current) => {
            const kept = [...current].filter((id) => documents.some((document) => document.id === id))

            return kept.length === current.size ? current : new Set(kept)
        })
    }, [documents])

    const visible = useMemo(
        () =>
            sortDocuments(
                documents.map((document) => ({...document, name: displayName(document)})).filter((document) => matchesSearch(document, search)),
                sort,
            ),
        [documents, search, sort],
    )

    const groups = useMemo(() => (sort === 'changed' ? groupByTime(visible, new Date()) : [{group: null, documents: visible}]), [visible, sort])

    // The panel always says something: the picked document while it's listed, or the first one.
    const picked = visible.find((document) => document.id === pickedId) ?? visible[0] ?? null
    const tickedIds = visible.filter((document) => ticked.has(document.id)).map((document) => document.id)

    const focusTile = (id: string) => {
        pick(id)
        grid.current?.querySelector<HTMLElement>(`[data-document-id="${CSS.escape(id)}"]`)?.focus()
    }

    const toggleTick = (id: string) => {
        const next = new Set(ticked)

        // The first Ctrl-click ticks what was picked too, as in a file browser.
        if (next.size === 0 && picked && picked.id !== id) {
            next.add(picked.id)
        }

        if (!next.delete(id)) {
            next.add(id)
        }

        setTicked(next)
    }

    const onTileClick = (event: MouseEvent, id: string) => {
        if (event.ctrlKey || event.metaKey) {
            toggleTick(id)
        } else if (event.shiftKey && picked) {
            const from = visible.findIndex((document) => document.id === picked.id)
            const to = visible.findIndex((document) => document.id === id)
            const [start, end] = from < to ? [from, to] : [to, from]

            setTicked(new Set(visible.slice(start, end + 1).map((document) => document.id)))
            return
        } else {
            setTicked(new Set())
        }

        pick(id)
    }

    const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target instanceof HTMLInputElement) {
            return
        }

        if (event.key === 'Escape' && ticked.size > 0) {
            event.preventDefault()
            event.stopPropagation()
            setTicked(new Set())
            return
        }

        if (!picked) {
            return
        }

        const index = visible.findIndex((document) => document.id === picked.id)
        const across = columnsOf(grid.current?.querySelector('.library-page__grid') ?? null)
        const moves: Record<string, number> = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -across, ArrowDown: across}

        if (event.key in moves) {
            event.preventDefault()
            const next = visible[Math.min(visible.length - 1, Math.max(0, index + moves[event.key]))]

            if (next) {
                focusTile(next.id)
            }
        } else if (event.key === ' ') {
            event.preventDefault()
            toggleTick(picked.id)
        } else if (event.key === 'Enter' && picked.kind !== null) {
            event.preventDefault()
            void open(picked.id)
        } else if (event.key === 'F2') {
            event.preventDefault()
            setRequest({at: event.timeStamp})
        } else if (event.key === 'Delete') {
            event.preventDefault()
            setTicked(new Set())
            void remove(tickedIds.length > 0 ? tickedIds : [picked.id])
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            // Typing anywhere in the grid starts a search, as in a file browser.
            searchField.current?.focus()
        }
    }

    return (
        <main className="home library-page">
            <div className="library-page__inner">
                <header className="library-page__head">
                    <button type="button" className="icon-button" aria-label="Back to Home" title="Home" onClick={showHome}>
                        <ArrowLeft size={15} aria-hidden="true" />
                    </button>
                    <h1 className="home__title">Your {plural}</h1>
                </header>

                {inRemoved ? (
                    <Removed onBack={() => setInRemoved(false)} />
                ) : (
                    <>
                        <div className="library-page__toolbar">
                            <div className="filter library-page__search">
                                <Search size={13} aria-hidden="true" className="filter__icon" />
                                <input
                                    ref={searchField}
                                    className="filter__input"
                                    placeholder={`Search your ${plural}`}
                                    aria-label={`Search your ${plural}`}
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape' && search) {
                                            event.stopPropagation()
                                            setSearch('')
                                        }
                                    }}
                                />
                                {search ? (
                                    <button type="button" className="filter__clear" aria-label="Clear search" onClick={() => setSearch('')}>
                                        <X size={12} aria-hidden="true" />
                                    </button>
                                ) : null}
                            </div>

                            <div className="library-page__sort">
                                <Select label={`Sort your ${plural}`} value={sort} options={SORTS} onChange={setSort} />
                            </div>
                        </div>

                        <div className="library-page__body">
                            <div className="library-page__list" ref={grid} onKeyDown={onGridKey}>
                                {loading && documents.length === 0 ? (
                                    <p className="dialog__hint" role="status">
                                        Looking for your {plural}…
                                    </p>
                                ) : documents.length === 0 ? (
                                    <p className="dialog__hint">{`${documentType.noun[0].toUpperCase()}${documentType.noun.slice(1)}s`} you save show up here.</p>
                                ) : visible.length === 0 ? (
                                    <p className="dialog__hint">Nothing by that name. Try a shorter word.</p>
                                ) : (
                                    groups.map(({group, documents: inGroup}) => (
                                        <section key={group ?? 'all'} aria-label={group ?? `Your ${plural}`}>
                                            {group ? <h2 className="settings__group">{group}</h2> : null}
                                            <ul className="tile-grid library-page__grid">
                                                {inGroup.map((document) => (
                                                    <li
                                                        key={document.id}
                                                        className="document-tile"
                                                        data-current={document.id === currentId}
                                                        data-picked={tickedIds.length === 0 && document.id === picked?.id}
                                                        data-ticked={ticked.has(document.id)}
                                                    >
                                                        <button
                                                            type="button"
                                                            className="document-tile__open"
                                                            data-document-id={document.id}
                                                            title={document.name}
                                                            aria-pressed={document.id === picked?.id}
                                                            tabIndex={document.id === picked?.id ? 0 : -1}
                                                            onClick={(event) => onTileClick(event, document.id)}
                                                            onDoubleClick={() => (document.kind !== null ? void open(document.id) : undefined)}
                                                        >
                                                            <span className="document-tile__thumb">
                                                                <DocumentPicture document={document} />
                                                            </span>
                                                            <span className="document-tile__name">{document.name}</span>
                                                            <span className="document-tile__meta">
                                                                {savedLabel(document.savedAt)}
                                                                {document.id === currentId ? <span className="document-tile__badge">Editing</span> : null}
                                                            </span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="document-tile__tick"
                                                            role="checkbox"
                                                            aria-checked={ticked.has(document.id)}
                                                            aria-label={`Tick ${document.name}`}
                                                            tabIndex={-1}
                                                            onClick={() => toggleTick(document.id)}
                                                        >
                                                            {ticked.has(document.id) ? <Check size={12} aria-hidden="true" /> : null}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    ))
                                )}

                                {removed.length > 0 ? (
                                    <button type="button" className="button library-page__bin-link" onClick={() => setInRemoved(true)}>
                                        <Trash2 size={13} aria-hidden="true" />
                                        Recently removed ({removed.length})
                                    </button>
                                ) : null}
                            </div>

                            {tickedIds.length > 0 ? (
                                <TickedDetails ids={tickedIds} onClear={() => setTicked(new Set())} />
                            ) : picked ? (
                                <Details document={picked} editing={picked.id === currentId} request={request} />
                            ) : null}
                        </div>
                    </>
                )}
            </div>
        </main>
    )
}
