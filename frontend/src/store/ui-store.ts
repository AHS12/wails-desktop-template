/**
 * What the interface is showing: which dialogs are open, and passing moments such
 * as a confirm question. Nothing here is saved or undoable.
 */

import {create} from 'zustand'
import {settingValue} from './settings-store'

/** A page of Settings, by the name in its side list. Features add pages of their own. */
export type SettingsPageId = string

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

    whatsNewOpen: boolean
    setWhatsNewOpen(open: boolean): void

    confirm: ConfirmRequest | null
    askConfirm(request: ConfirmRequest | null): void

    /**
     * Features showing a person something first, such as the tour on a first start.
     * What's new waits until none is.
     */
    holds: Readonly<Record<string, boolean>>
    setHold(feature: string, holding: boolean): void

    /** True once the close is agreed, while features finish what they must first. */
    closing: boolean
    setClosing(closing: boolean): void
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

    whatsNewOpen: false,
    setWhatsNewOpen: (whatsNewOpen) => set({whatsNewOpen}),

    confirm: null,
    askConfirm: (confirm) => set({confirm}),

    holds: {},
    setHold: (feature, holding) => set((state) => (state.holds[feature] === holding ? state : {holds: {...state.holds, [feature]: holding}})),

    closing: false,
    setClosing: (closing) => set({closing}),
}))
