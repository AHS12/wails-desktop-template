/**
 * What the interface is showing: which dialogs are open, and passing moments such
 * as a confirm question. Nothing here is saved or undoable.
 */

import {create} from 'zustand'
import {settingValue} from './settings-store'
import type {ReportKind} from '../core/feedback/report-forms'

/** What someone has typed into Report a problem so far. */
export interface ReportDraft {
    readonly kind: ReportKind
    readonly title: string
    readonly fields: Readonly<Record<string, string>>
}

export type SettingsPageId = 'General' | 'Appearance' | 'Keyboard' | 'Storage' | 'Backup' | 'Recently removed' | 'About'

export interface ConfirmRequest {
    readonly title: string
    readonly text: string
    readonly action: string
    readonly danger?: boolean
    /** The cancel button's words, when Cancel doesn't say enough. */
    readonly cancel?: string
    /** Shows a Don't ask again tick box, and passes whether it was ticked to run. */
    readonly offerDontAsk?: boolean
    readonly run: (dontAskAgain: boolean) => void
    readonly onCancel?: () => void
}

interface UiStore {
    paletteOpen: boolean
    setPaletteOpen(open: boolean): void

    settingsPage: SettingsPageId | null
    openSettings(page?: SettingsPageId): void
    closeSettings(): void

    tourOpen: boolean
    setTourOpen(open: boolean): void

    whatsNewOpen: boolean
    setWhatsNewOpen(open: boolean): void

    /** True while Report a problem is open. */
    reportOpen: boolean
    setReportOpen(open: boolean): void
    /** What was typed into Report a problem, kept until it's sent or the app closes, so a stray click loses nothing. */
    reportDraft: ReportDraft | null
    setReportDraft(draft: ReportDraft | null): void

    confirm: ConfirmRequest | null
    askConfirm(request: ConfirmRequest | null): void
}

/** Whether someone's system or Settings asks for less movement on screen. */
export function asksForLessMotion(): boolean {
    return settingValue('reduceMotion') === true || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export const useUiStore = create<UiStore>((set) => ({
    paletteOpen: false,
    setPaletteOpen: (paletteOpen) => set({paletteOpen}),

    settingsPage: null,
    openSettings: (page = 'General') => set({settingsPage: page, paletteOpen: false}),
    closeSettings: () => set({settingsPage: null}),

    tourOpen: false,
    setTourOpen: (tourOpen) => set({tourOpen}),

    whatsNewOpen: false,
    setWhatsNewOpen: (whatsNewOpen) => set({whatsNewOpen}),

    reportOpen: false,
    setReportOpen: (reportOpen) => set({reportOpen, paletteOpen: false}),
    reportDraft: null,
    setReportDraft: (reportDraft) => set({reportDraft}),

    confirm: null,
    askConfirm: (confirm) => set({confirm}),
}))
