/**
 * Export many…: saved documents, without opening them, as the formats picked, into
 * one folder. It shows how far it has got, can stop between documents, and says at
 * the end what it couldn't do.
 */

import {useEffect, useState} from 'react'
import {Dialog} from '../../components/controls'
import {chooseFolder, showFolder} from '../../platform/desktop'
import {documentType, useDocumentStore} from '../../store/document-store'
import {FolderChoice, FormatChoices} from './ExportChoices'
import {filesAlreadyThere, useExportStore} from './export-store'
import {filesAre} from './formats'
import {writesToFolders} from './platform'
import {loadExportPreferences, saveExportPreferences, type ExportPreferences} from './preferences'

const plural = () => `${documentType.noun}s`

function Progress() {
    const run = useExportStore((state) => state.run)
    const stop = useExportStore((state) => state.stop)

    if (!run) {
        return null
    }

    return (
        <div className="export__progress" role="status">
            <span className="dialog__hint">
                {run.current ? `Exporting “${run.current}”, ` : 'Exporting, '}
                {run.done} of {run.total}
            </span>
            <progress className="dialog__progress" max={run.total} value={run.done} aria-label={`${plural()} exported`} />
            <div className="dialog__actions">
                <button type="button" className="button" onClick={stop}>
                    Stop
                </button>
            </div>
        </div>
    )
}

function Summary({onDone}: {onDone(): void}) {
    const run = useExportStore((state) => state.run)

    if (!run) {
        return null
    }

    const exported = run.done - run.failed.length

    return (
        <div className="export__summary" role="status">
            <p className="dialog__hint">
                {run.stopped ? 'Stopped. ' : ''}
                Exported {exported === 1 ? `1 ${documentType.noun}` : `${exported} ${plural()}`}
                {run.stopped ? ` of ${run.total}` : ''}.
            </p>
            {run.failed.length > 0 ? (
                <p className="dialog__hint export__failed">Couldn't export: {run.failed.join(', ')}. Each may be damaged, or from a newer version.</p>
            ) : null}
            <div className="dialog__actions">
                {writesToFolders() && exported > 0 ? (
                    <button type="button" className="button" onClick={() => void showFolder(run.folder)}>
                        Show the files
                    </button>
                ) : null}
                <button type="button" className="button button--primary" onClick={onDone}>
                    Done
                </button>
            </div>
        </div>
    )
}

export function ExportManyDialog() {
    const open = useExportStore((state) => state.dialog === 'many')
    const picked = useExportStore((state) => state.picked)
    const formats = useExportStore((state) => state.formats)
    const run = useExportStore((state) => state.run)
    const close = useExportStore((state) => state.close)
    const exportMany = useExportStore((state) => state.exportMany)
    const clearRun = useExportStore((state) => state.clearRun)
    const documents = useDocumentStore((state) => state.documents)
    const refreshDocuments = useDocumentStore((state) => state.refreshDocuments)
    const [preferences, setPreferences] = useState<ExportPreferences>({folder: '', formats: []})
    const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())
    const [inTheWay, setInTheWay] = useState<readonly string[] | null>(null)

    useEffect(() => {
        if (open) {
            void refreshDocuments()
            setPreferences(loadExportPreferences(formats.map((format) => format.id)))
            setTicked(new Set(picked))
            setInTheWay(null)
        }
    }, [open, picked, formats, refreshDocuments])

    const readable = documents.filter((document) => document.kind !== null)
    const chosen = readable.filter((document) => ticked.has(document.id))
    const running = run !== null && !run.finished

    const finish = () => {
        clearRun()
        close()
    }

    const start = async (replace: boolean) => {
        let folder = preferences.folder

        if (!folder) {
            folder = (await chooseFolder('', 'Export to this folder')) ?? ''

            if (!folder) {
                return
            }

            setPreferences({...preferences, folder})
        }

        if (!replace) {
            const there = await filesAlreadyThere(chosen, preferences.formats, folder)

            if (there.length > 0) {
                setInTheWay(there)
                return
            }
        }

        setInTheWay(null)
        saveExportPreferences({...preferences, folder})
        await exportMany(chosen, preferences.formats, folder)
    }

    const toggle = (id: string) => {
        const next = new Set(ticked)

        if (!next.delete(id)) {
            next.add(id)
        }

        setTicked(next)
    }

    return (
        <Dialog
            open={open}
            onClose={running ? () => undefined : finish}
            dismissable={!running}
            closesOnOutsideClick={false}
            title={`Export many ${plural()}`}
            width={560}
        >
            <div className="dialog__form export">
                {run ? (
                    run.finished ? (
                        <Summary onDone={finish} />
                    ) : (
                        <Progress />
                    )
                ) : inTheWay ? (
                    <>
                        <p className="dialog__hint">
                            {filesAre(inTheWay.length)} there already. Replacing {inTheWay.length === 1 ? 'it' : 'them'} can't be undone.
                        </p>
                        <div className="dialog__actions">
                            <button type="button" className="button" onClick={() => setInTheWay(null)}>
                                Keep them
                            </button>
                            <button type="button" className="button button--danger" onClick={() => void start(true)}>
                                Replace
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="export__list-head">
                            <span className="dialog__label">
                                {chosen.length} of {readable.length} ticked
                            </span>
                            <button
                                type="button"
                                className="text-button"
                                onClick={() => setTicked(chosen.length === readable.length ? new Set() : new Set(readable.map((document) => document.id)))}
                            >
                                {chosen.length === readable.length ? 'Tick none' : 'Tick all'}
                            </button>
                        </div>
                        {readable.length === 0 ? (
                            <p className="dialog__hint">Save a {documentType.noun} first, then export it from here.</p>
                        ) : (
                            <ul className="export__list">
                                {readable.map((document) => (
                                    <li key={document.id}>
                                        <label className="export__format">
                                            <input type="checkbox" checked={ticked.has(document.id)} onChange={() => toggle(document.id)} />
                                            <span>{document.name}</span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <FormatChoices formats={formats} chosen={preferences.formats} onChange={(next) => setPreferences({...preferences, formats: next})} />
                        <FolderChoice folder={preferences.folder} onChange={(folder) => setPreferences({...preferences, folder})} />
                        <div className="dialog__actions">
                            <button type="button" className="button" onClick={finish}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="button button--primary"
                                disabled={chosen.length === 0 || preferences.formats.length === 0}
                                onClick={() => void start(false)}
                            >
                                {chosen.length === 1 ? `Export 1 ${documentType.noun}` : `Export ${chosen.length} ${plural()}`}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Dialog>
    )
}
