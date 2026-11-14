/**
 * Report a problem: GitHub's issue forms, asked in the app, with the version and
 * system filled in. Nothing is sent from the app; the browser opens the form.
 */

import './report.css'
import {MessageSquareWarning} from 'lucide-react'
import type {Feature} from '../../shell/feature'
import {ReportDialog} from './ReportDialog'
import {useReportStore} from './report-store'

export const report: Feature = {
    id: 'report',
    commands: [
        {
            id: 'report-problem',
            label: 'Report a problem…',
            group: 'Help',
            icon: MessageSquareWarning,
            global: true,
            keywords: 'bug issue feedback broken wrong idea suggest request github',
            run: () => useReportStore.getState().setReportOpen(true),
        },
    ],
    menus: {Help: ['report-problem']},
    dialogs: [ReportDialog],
    ownsKeyboard: () => useReportStore.getState().reportOpen,
}
