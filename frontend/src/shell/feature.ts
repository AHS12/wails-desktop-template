/**
 * What an optional feature can add to the shell, and the list of those in this app.
 *
 * The shell never imports a feature. It asks this registry, so removing a feature is
 * deleting its folder and its line in features/index.ts: nothing here or in the shell
 * names it. docs/removing-features.md has the steps, Go side included.
 */

import type {ComponentType} from 'react'
import type {LucideIcon} from 'lucide-react'
import type {SavedDocument} from '../platform/documents'
import type {Command} from './commands'

/** The menus a feature can add to, by their titles in the menu bar. */
export type MenuTitle = 'File' | 'Edit' | 'View' | 'Help'

/** A page of its own in Settings. */
export interface FeatureSettingsPage {
    /** Its name in the side list, which is also how a command opens it. */
    readonly id: string
    readonly icon: LucideIcon
    readonly Page: ComponentType
    /** What needs a look, if anything, for a dot beside the page and beside Settings. */
    readonly useAttention?: () => string | null
}

export interface Feature {
    readonly id: string
    /** Its commands, for the palette, the keys and the menus. */
    readonly commands?: readonly Command[]
    /** Command ids to add to a menu, as one group, where the menu leaves room for features. */
    readonly menus?: Readonly<Partial<Record<MenuTitle, readonly string[]>>>
    /** Its own pages in Settings, before About. */
    readonly settingsPages?: readonly FeatureSettingsPage[]
    /** Rows it adds to the shell's own settings pages, such as General. */
    readonly settingRows?: readonly {readonly page: string; readonly Row: ComponentType}[]
    /** Dialogs it draws. Each is always there and opens itself. */
    readonly dialogs?: readonly ComponentType[]
    /** Runs once the settings are read at start. What it returns undoes it. */
    readonly start?: () => (() => void) | void
    /** True while a window of its own is open, which then owns the keyboard. */
    readonly ownsKeyboard?: () => boolean
    /** Work to finish before the app closes, such as a backup that is due. */
    readonly beforeClose?: () => Promise<void>
    /** Drawn on Home when nothing has been saved yet. */
    readonly HomeEmpty?: ComponentType
    /** More about a saved document, beside the library page's list, as dt and dd pairs. */
    readonly DocumentFacts?: ComponentType<{readonly document: SavedDocument}>
    /** Buttons for the picked document, or every ticked one, on the library page. */
    readonly DocumentActions?: ComponentType<{readonly ids: readonly string[]}>
}

let registered: readonly Feature[] = []

/** Puts the app's features in place. main.tsx does it once, before drawing anything. */
export function registerFeatures(list: readonly Feature[]): void {
    registered = list
}

/** The features in this app, in the order they're listed. */
export const features = (): readonly Feature[] => registered

export const hasFeature = (id: string): boolean => registered.some((feature) => feature.id === id)
