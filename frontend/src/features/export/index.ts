/**
 * Export: the open document, or many saved ones, as files in formats the app
 * names, into a folder. The Go side is backend/export, registered in main.go.
 */

import './export.css'
import {Download, FileDown} from 'lucide-react'
import type {Feature} from '../../shell/feature'
import {documentType, type Content} from '../../store/document-store'
import {ExportButton} from './ExportButton'
import {ExportDialog} from './ExportDialog'
import {ExportManyDialog} from './ExportManyDialog'
import {useExportStore} from './export-store'
import type {ExportFormat} from './formats'

/** The export feature, offering these formats. */
export function exporting(formats: readonly ExportFormat<Content>[]): Feature {
    useExportStore.setState({formats})

    return {
        id: 'export',
        commands: [
            {
                id: 'export',
                label: 'Export…',
                group: 'File',
                shortcut: 'Ctrl+E',
                icon: Download,
                keywords: formats.map((format) => `${format.label} ${format.extension}`).join(' '),
                run: () => useExportStore.getState().openOne(),
            },
            {
                id: 'export-many',
                label: 'Export many…',
                group: 'File',
                icon: FileDown,
                global: true,
                keywords: `batch all several ${documentType.noun}s`,
                run: () => useExportStore.getState().openMany(),
            },
        ],
        menus: {File: ['export', 'export-many']},
        dialogs: [ExportDialog, ExportManyDialog],
        ownsKeyboard: () => useExportStore.getState().dialog !== null,
        DocumentActions: ExportButton,
    }
}
