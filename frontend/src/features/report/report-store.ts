/** Whether Report a problem is open, and what has been typed into it so far. */

import {create} from 'zustand'
import {useUiStore} from '../../store/ui-store'
import type {ReportKind} from './report-forms'

/** What someone has typed into Report a problem so far. */
export interface ReportDraft {
    readonly kind: ReportKind
    readonly title: string
    readonly fields: Readonly<Record<string, string>>
}

interface ReportStore {
    reportOpen: boolean
    setReportOpen(open: boolean): void
    /** Kept until it's sent or the app closes, so a stray click loses nothing. */
    reportDraft: ReportDraft | null
    setReportDraft(draft: ReportDraft | null): void
}

export const useReportStore = create<ReportStore>((set) => ({
    reportOpen: false,
    setReportOpen: (reportOpen) => {
        if (reportOpen) {
            useUiStore.getState().setPaletteOpen(false)
        }

        set({reportOpen})
    },
    reportDraft: null,
    setReportDraft: (reportDraft) => set({reportDraft}),
}))
