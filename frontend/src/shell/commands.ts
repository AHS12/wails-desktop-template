/**
 * Everything the app can do, in one list: the shell's own commands, and each
 * feature's.
 *
 * The palette, the menus, the Keyboard settings page and the key handler all read
 * this list, so a command can't exist in one place and be missing from another.
 */

import type {LucideIcon} from 'lucide-react'
import {
    Check, FilePlus, FolderOpen, Home, Keyboard, Library, LogOut, Redo2, RefreshCw, Save, Search, Settings, Sparkles, SunMoon, Trash2, Undo2,
} from 'lucide-react'
import {APP} from '../core/app'
import {canRedo, canUndo} from '../core/history/history'
import {documentType, hasUnsavedChanges, useDocumentStore, type DocumentStore} from '../store/document-store'
import {settingValue, useSettingsStore} from '../store/settings-store'
import {useUiStore} from '../store/ui-store'
import {useUpdateStore} from '../store/update-store'
import {canCheckForUpdates} from '../platform/update'
import {canQuit, quitApp} from '../platform/window'
import {features} from './feature'

export type CommandId = string

export interface Command {
    readonly id: CommandId
    readonly label: string
    readonly group: string
    /** Written the way the user presses it, e.g. "Ctrl+Z". */
    readonly shortcut?: string
    /** Extra words the palette should match on. */
    readonly keywords?: string
    readonly icon?: LucideIcon
    /** Null when it can run, otherwise why it can't. */
    readonly unavailable?: (state: DocumentStore) => string | null
    /** Offered first while this is true. */
    readonly relevant?: (state: DocumentStore) => boolean
    /** Opens a sub-list instead of running. */
    readonly children?: (state: DocumentStore) => readonly Command[]
    /** Whether a choice in a sub-list is the current one. */
    readonly checked?: (state: DocumentStore) => boolean
    /** Works without a document on screen, on the home page. */
    readonly global?: boolean
    readonly run: (state: DocumentStore) => void
}

const THEMES = [
    {value: 'system', label: 'System'},
    {value: 'dark', label: 'Dark'},
    {value: 'light', label: 'Light'},
]

/** Runs something that replaces the document, asking first if that loses work. */
export function guardUnsaved(state: DocumentStore, action: string, run: () => void) {
    if (!hasUnsavedChanges(state)) {
        run()
        return
    }

    useUiStore.getState().askConfirm({
        title: `${action}?`,
        text: `You have unsaved changes to this ${documentType.noun}. Undo can't bring them back after this.`,
        action,
        danger: true,
        run,
    })
}

const togglePalette = () => {
    const ui = useUiStore.getState()

    ui.setPaletteOpen(!ui.paletteOpen)
}

/** The shell's own commands. */
const SHELL_COMMANDS: readonly Command[] = [
    {
        id: 'new',
        label: `New ${documentType.noun}`,
        group: 'File',
        shortcut: 'Ctrl+N',
        icon: FilePlus,
        global: true,
        keywords: 'start create blank empty',
        run: (state) => guardUnsaved(state, `Start a new ${documentType.noun}`, () => state.startNew()),
    },
    {
        id: 'documents',
        label: `Your ${documentType.noun}s`,
        group: 'File',
        shortcut: 'Ctrl+G',
        icon: Library,
        global: true,
        keywords: 'library saved open recent all browse documents',
        run: (state) => state.showDocuments(),
    },
    {
        id: 'home',
        label: 'Home',
        group: 'File',
        icon: Home,
        global: true,
        keywords: 'start page welcome begin',
        run: (state) => state.showHome(),
    },
    {
        id: 'open-file',
        label: 'Open a file…',
        group: 'File',
        shortcut: 'Ctrl+O',
        icon: FolderOpen,
        global: true,
        keywords: 'load read disk json dialog',
        run: (state) => guardUnsaved(state, 'Open a file', () => void state.openFromFile()),
    },
    {
        id: 'save',
        label: 'Save',
        group: 'File',
        shortcut: 'Ctrl+S',
        icon: Save,
        keywords: 'write keep library',
        run: (state) => void state.save(),
    },
    {
        id: 'save-copy',
        label: 'Save a copy…',
        group: 'File',
        shortcut: 'Ctrl+Shift+S',
        keywords: 'write duplicate new version',
        run: (state) => void state.save(true),
    },
    {
        id: 'save-to-file',
        label: 'Save to a file…',
        group: 'File',
        keywords: 'write disk json dialog choose folder',
        run: (state) => void state.saveToFile(),
    },
    {
        id: 'recently-removed',
        label: 'Recently removed',
        group: 'File',
        icon: Trash2,
        global: true,
        keywords: 'bin trash recycle deleted removed restore put back undelete empty',
        run: () => useUiStore.getState().openSettings('Recently removed'),
    },
    {
        id: 'settings',
        label: 'Settings',
        group: 'File',
        shortcut: 'Ctrl+,',
        icon: Settings,
        global: true,
        keywords: 'preferences options config',
        run: () => useUiStore.getState().openSettings(),
    },
    {
        id: 'quit',
        label: 'Quit',
        group: 'File',
        shortcut: 'Ctrl+Q',
        icon: LogOut,
        global: true,
        keywords: 'exit close leave',
        unavailable: () => (canQuit() ? null : 'Only the desktop app can quit.'),
        run: () => void quitApp(),
    },
    {
        id: 'undo',
        label: 'Undo',
        group: 'Edit',
        shortcut: 'Ctrl+Z',
        icon: Undo2,
        unavailable: (state) => (canUndo(state.history) ? null : 'Nothing to undo yet'),
        run: (state) => state.undo(),
    },
    {
        id: 'redo',
        label: 'Redo',
        group: 'Edit',
        shortcut: 'Ctrl+Shift+Z',
        icon: Redo2,
        unavailable: (state) => (canRedo(state.history) ? null : 'Nothing to redo'),
        run: (state) => state.redo(),
    },
    {
        id: 'theme',
        label: 'Theme',
        group: 'View',
        icon: SunMoon,
        global: true,
        keywords: 'dark light mode appearance',
        children: () =>
            THEMES.map(
                ({value, label}): Command => ({
                    id: `theme-${value}`,
                    label,
                    group: 'View',
                    global: true,
                    checked: () => settingValue('theme') === value,
                    run: () => useSettingsStore.getState().setValue('theme', value),
                }),
            ),
        run: () => undefined,
    },
    {
        id: 'palette',
        label: 'Search or run a command',
        group: 'Help',
        shortcut: 'Ctrl+K',
        icon: Search,
        global: true,
        keywords: 'find commands palette',
        run: togglePalette,
    },
    {
        id: 'palette-alt',
        label: 'Search or run a command (other key)',
        group: 'Help',
        shortcut: 'Ctrl+Shift+P',
        global: true,
        keywords: 'find commands palette',
        run: togglePalette,
    },
    {
        id: 'shortcuts',
        label: 'Keyboard shortcuts',
        group: 'Help',
        shortcut: 'Ctrl+/',
        icon: Keyboard,
        global: true,
        keywords: 'help keys cheatsheet',
        run: () => useUiStore.getState().openSettings('Keyboard'),
    },
    {
        id: 'whats-new',
        label: "What's new",
        group: 'Help',
        icon: Sparkles,
        global: true,
        keywords: 'changelog release notes version update',
        run: () => useUiStore.getState().setWhatsNewOpen(true),
    },
    {
        id: 'check-updates',
        label: 'Check for updates',
        group: 'Help',
        icon: RefreshCw,
        global: true,
        keywords: 'update upgrade new version download',
        unavailable: () => (canCheckForUpdates() ? null : 'Updates are only available in the desktop app.'),
        run: () => {
            useUiStore.getState().openSettings('About')
            void useUpdateStore.getState().check()
        },
    },
    {
        id: 'about',
        label: `About ${APP.name}`,
        group: 'Help',
        icon: Check,
        global: true,
        keywords: 'version licences',
        run: () => useUiStore.getState().openSettings('About'),
    },
]

/** Every command: the shell's, then each feature's. */
export function allCommands(): readonly Command[] {
    return [...SHELL_COMMANDS, ...features().flatMap((feature) => feature.commands ?? [])]
}

/**
 * Runs a command. One that can't run says why, and never silently does nothing.
 */
export function runCommand(command: Command): void {
    const state = useDocumentStore.getState()
    const reason = command.unavailable?.(state)

    if (reason) {
        useDocumentStore.setState({toast: {message: reason, undoable: false}})
        return
    }

    command.run(state)
}

/** The command with this id, if there is one, looking inside sub-lists too. */
export function findCommand(id: string, state?: DocumentStore): Command | undefined {
    const commands = allCommands()
    const top = commands.find((command) => command.id === id)

    if (top || !state) {
        return top
    }

    for (const command of commands) {
        const child = command.children?.(state).find((entry) => entry.id === id)

        if (child) {
            return child
        }
    }

    return undefined
}

/** The keys that run a command now: the user's choice, or else the default. */
export function shortcutFor(id: CommandId): string | undefined {
    const chosen = useSettingsStore.getState().shortcuts[id]

    if (chosen !== undefined) {
        return chosen === '' ? undefined : chosen
    }

    return allCommands().find((command) => command.id === id)?.shortcut
}

/** The command bound to these keys, if any. */
export function commandForKeys(keys: string): Command | undefined {
    return allCommands().find((command) => shortcutFor(command.id) === keys)
}

/**
 * The key string for an event, in the same shape the shortcuts are written.
 *
 * A letter reports its own case, so Shift has to be added back explicitly;
 * otherwise `P` and `Shift+P` would look identical.
 */
export function shortcutOf(event: KeyboardEvent): string {
    const parts: string[] = []

    if (event.ctrlKey || event.metaKey) {
        parts.push('Ctrl')
    }
    if (event.altKey) {
        parts.push('Alt')
    }
    if (event.shiftKey && /^[a-zA-Z]$/.test(event.key)) {
        parts.push('Shift')
    }

    const key = event.key.length === 1 ? event.key.toUpperCase() : event.key
    parts.push(key === 'Escape' ? 'Esc' : key)

    return parts.join('+')
}

/** How a shortcut reads on screen. */
export const displayKeys = (keys: string) => keys.replace(/\+ $/, '+Space')
