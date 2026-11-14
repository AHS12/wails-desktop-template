/**
 * Export…: the open document as the formats picked, into a folder. Files already
 * there are named, and replaced only when the person says so.
 */

import {useEffect, useState} from 'react'
import {Dialog} from '../../components/controls'
import {chooseFolder} from '../../platform/desktop'
import {documentType, useDocumentStore} from '../../store/document-store'
import {FolderChoice, FormatChoices} from './ExportChoices'
import {useExportStore} from './export-store'
import {exportFiles, filesAre} from './formats'
import {existingFiles, writeFiles, writesToFolders} from './platform'
import {loadExportPreferences, saveExportPreferences, type ExportPreferences} from './preferences'

export function ExportDialog() {
    const open = useExportStore((state) => state.dialog === 'one')
    const formats = useExportStore((state) => state.formats)
    const close = useExportStore((state) => state.close)
    const name = useDocumentStore((state) => state.name)
    const notify = useDocumentStore((state) => state.notify)
    const [preferences, setPreferences] = useState<ExportPreferences>({folder: '', formats: []})
    // The files that would be replaced, while the dialog asks about them.
    const [inTheWay, setInTheWay] = useState<readonly string[] | null>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (open) {
            setPreferences(loadExportPreferences(formats.map((format) => format.id)))
            setInTheWay(null)
        }
    }, [open, formats])

    const chosen = formats.filter((format) => preferences.formats.includes(format.id))

    const run = async (replace: boolean) => {
        let folder = preferences.folder

        if (!folder) {
            folder = (await chooseFolder('', 'Export to this folder')) ?? ''

            if (!folder) {
                return
            }

            setPreferences({...preferences, folder})
        }

        setBusy(true)

        try {
            const files = exportFiles(chosen, name, useDocumentStore.getState().content)

            if (!replace) {
                const there = await existingFiles(folder, files.map((file) => file.name))

                if (there.length > 0) {
                    setInTheWay(there)
                    return
                }
            }

            await writeFiles(folder, files)
            saveExportPreferences({...preferences, folder})
            close()
            notify(files.length === 1 ? `Exported ${files[0].name}` : `Exported ${files.length} files`, writesToFolders() ? folder : undefined)
        } catch (error) {
            notify(`Couldn't export. ${error instanceof Error ? error.message : String(error)}`)
        } finally {
            setBusy(false)
        }
    }

    return (
        <Dialog open={open} onClose={close} title={`Export this ${documentType.noun}`} width={480}>
            <div className="dialog__form export">
                {inTheWay ? (
                    <>
                        <p className="dialog__hint">
                            {filesAre(inTheWay.length)} there already: {inTheWay.join(', ')}. Replacing {inTheWay.length === 1 ? 'it' : 'them'} can't be
                            undone.
                        </p>
                        <div className="dialog__actions">
                            <button type="button" className="button" onClick={() => setInTheWay(null)}>
                                Keep them
                            </button>
                            <button type="button" className="button button--danger" disabled={busy} onClick={() => void run(true)}>
                                Replace
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <FormatChoices formats={formats} chosen={preferences.formats} onChange={(next) => setPreferences({...preferences, formats: next})} />
                        <FolderChoice folder={preferences.folder} onChange={(folder) => setPreferences({...preferences, folder})} />
                        <div className="dialog__actions">
                            <button type="button" className="button" onClick={close}>
                                Cancel
                            </button>
                            <button type="button" className="button button--primary" disabled={busy || chosen.length === 0} onClick={() => void run(false)}>
                                Export
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Dialog>
    )
}
