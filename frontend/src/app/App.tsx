import {useEffect, useState} from 'react'
import {commandForKeys, runCommand, shortcutOf} from '../shell/commands'
import {applyTheme, resolveTheme, watchSystemTheme, type ThemeChoice} from '../core/settings/theme'
import {NoteEditor} from '../example/NoteEditor'
import {CloseDialog} from '../shell/CloseDialog'
import {CommandPalette} from '../shell/CommandPalette'
import {ConfirmDialog} from '../shell/ConfirmDialog'
import {features} from '../shell/feature'
import {MenuBar} from '../shell/MenuBar'
import {SaveDialog} from '../shell/SaveDialog'
import {SettingsDialog} from '../shell/SettingsDialog'
import {StatusBar} from '../shell/StatusBar'
import {Toast} from '../shell/Toast'
import {WhatsNewDialog} from '../shell/WhatsNewDialog'
import {DocumentsPage} from '../shell/pages/DocumentsPage'
import {HomePage} from '../shell/pages/HomePage'
import {forgetOldRemovedDocuments} from '../platform/documents'
import {hasUnsavedChanges, isHomePage, useDocumentStore} from '../store/document-store'
import {setUnsaved} from '../platform/draft'
import {setCloseToTray, setMinimiseToTray} from '../platform/window'
import {confirmClose, onCloseRequested} from '../platform/close-guard'
import {cancelUpdateInstall} from '../platform/update'
import {settingNumber, settingValue, uiScale, useSettingsStore} from '../store/settings-store'
import {useUiStore} from '../store/ui-store'
import {checkForUpdatesIfDue} from '../store/update-store'

const ROOT_FONT_PX = 16

/** Commands whose keys a text field uses for itself. An editor that wants them handles them. */
const FIELD_KEYS = new Set(['undo', 'redo'])
/** How long after start the weekly update check waits. */
const UPDATE_CHECK_DELAY_MS = 5000

/** Runs every feature's work that has to be done before closing, such as a backup that is due. */
async function finishBeforeClosing(): Promise<void> {
    await Promise.allSettled(features().map((feature) => feature.beforeClose?.()))
}

/** Applies what the document element carries: theme, scale and motion. */
function applyAppearance() {
    const root = document.documentElement

    applyTheme(resolveTheme(settingValue('theme') as ThemeChoice))
    root.dataset.reduceMotion = String(settingValue('reduceMotion') === true)
    // Every style is in rems by the time it gets here, so this scales the interface.
    root.style.fontSize = `${ROOT_FONT_PX * uiScale()}px`
    root.style.setProperty('--ui-scale', String(uiScale()))
}

/** The page with a document on screen: the app's editor, and the status bar under it. */
function Editor() {
    return (
        <>
            <div className="editor-body">
                <NoteEditor />
            </div>
            <StatusBar />
        </>
    )
}

export function App() {
    const announcement = useDocumentStore((state) => state.announcement)
    const page = useDocumentStore((state) => state.page)
    const [closeRequested, setCloseRequested] = useState(false)

    // The shell cancels the close when work is unsaved, or a feature is busy, and
    // tells us. The question is ours to ask, in our own voice; with nothing unsaved
    // there's no question, only the work to finish.
    const closeWhenFinished = () => {
        setCloseRequested(false)
        useUiStore.getState().setClosing(true)
        void finishBeforeClosing().finally(() => void confirmClose())
    }

    useEffect(
        () =>
            onCloseRequested(() => {
                if (hasUnsavedChanges(useDocumentStore.getState())) {
                    setCloseRequested(true)
                } else {
                    closeWhenFinished()
                }
            }),
        [],
    )

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null
            const pressed = shortcutOf(event)
            const ui = useUiStore.getState()
            const documents = useDocumentStore.getState()
            const typing =
                target !== null &&
                (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
            const command = commandForKeys(pressed)

            if (!command) {
                return
            }

            // The palette stays one key away, even from inside a field or itself.
            const isPalette = command.id === 'palette' || command.id === 'palette-alt'

            // Never steal a key from a field the user is typing in. Ctrl and Alt shortcuts, such
            // as Save, still work there, except the ones a field answers itself.
            if (typing && !isPalette && (!/^(Ctrl|Alt)\+/.test(pressed) || FIELD_KEYS.has(command.id))) {
                return
            }

            // A question on screen owns the keyboard, and so do the windows.
            if (documents.savePrompt || closeRequested || ui.confirm || ui.whatsNewOpen || ui.settingsPage || features().some((feature) => feature.ownsKeyboard?.())) {
                return
            }

            if (ui.paletteOpen && !isPalette) {
                return
            }

            // Menus use the arrows and Space themselves, but no shortcut uses those,
            // so anything that reaches here is ours.

            // Home has no document on screen, so only some commands mean anything there.
            if (isHomePage(documents.page) && !command.global) {
                return
            }

            event.preventDefault()
            runCommand(command)
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [closeRequested])

    useEffect(() => {
        applyAppearance()

        // Go has to know before a button is pressed, so it isn't asked then.
        const applyWindowButtons = () => {
            void setCloseToTray(settingValue('closeButton') === 'tray')?.catch(() => undefined)
            void setMinimiseToTray(settingValue('minimiseButton') === 'tray')?.catch(() => undefined)
        }

        const unsubscribe = useSettingsStore.subscribe((state, previous) => {
            if (state.values !== previous.values) {
                applyAppearance()
            }

            if (state.loaded && (state.values.closeButton !== previous.values.closeButton || state.values.minimiseButton !== previous.values.minimiseButton)) {
                applyWindowButtons()
            }
        })
        const unwatch = watchSystemTheme(applyAppearance)
        let updateTimer: number | undefined
        let stopFeatures: (() => void)[] = []

        // Settings from the file win over the copy the first paint used.
        void useSettingsStore
            .getState()
            .load()
            .then(() => {
                applyAppearance()
                applyWindowButtons()

                const {values, lastDocumentId} = useSettingsStore.getState()

                // Only now does Go know which folder the documents are in.
                void forgetOldRemovedDocuments().catch(() => undefined)

                if (values.startOn === 'last' && lastDocumentId) {
                    void useDocumentStore.getState().open(lastDocumentId)
                }

                // After the first screen has settled, so it never slows the start.
                updateTimer = window.setTimeout(() => checkForUpdatesIfDue(), UPDATE_CHECK_DELAY_MS)

                stopFeatures = features().flatMap((feature) => feature.start?.() ?? [])
            })

        return () => {
            unsubscribe()
            unwatch()
            window.clearTimeout(updateTimer)
            stopFeatures.forEach((stop) => stop())
        }
    }, [])

    // Remembers the document in hand, for "Start on: last document".
    useEffect(
        () =>
            useDocumentStore.subscribe((state, previous) => {
                if (state.currentId !== previous.currentId) {
                    useSettingsStore.getState().setLastDocumentId(state.currentId)
                }
            }),
        [],
    )

    // Autosave: once a change settles, write the draft, so closing the window
    // cannot take unsaved work with it.
    useEffect(() => {
        let timer: number | undefined
        let reported: boolean | null = null

        const report = () => {
            const dirty = hasUnsavedChanges(useDocumentStore.getState())

            if (dirty !== reported) {
                reported = dirty
                void setUnsaved(dirty)
            }
        }

        const flush = () => {
            report()
            void useDocumentStore.getState().flushDraft()
        }

        const unsubscribe = useDocumentStore.subscribe((state, previous) => {
            if (state.content === previous.content && state.savedContent === previous.savedContent) {
                return
            }

            // The close guard has to know at once, whatever the draft's delay is.
            report()
            window.clearTimeout(timer)
            timer = window.setTimeout(flush, settingNumber('autosaveDelay'))
        })

        // Leaving the window is the last moment before a close, so do not wait.
        const onBlur = () => {
            window.clearTimeout(timer)
            flush()
        }

        window.addEventListener('blur', onBlur)
        report()

        return () => {
            unsubscribe()
            window.removeEventListener('blur', onBlur)
            window.clearTimeout(timer)
        }
    }, [])

    return (
        <div className="app-shell">
            <MenuBar home={isHomePage(page)} />
            {page === 'home' ? <HomePage /> : page === 'documents' ? <DocumentsPage /> : <Editor />}
            {features().flatMap(({id, dialogs = []}) => dialogs.map((Dialog, index) => <Dialog key={`${id}-${index}`} />))}
            <Toast />
            <SaveDialog />
            <SettingsDialog />
            <ConfirmDialog />
            <WhatsNewDialog />
            {closeRequested ? (
                <CloseDialog
                    onStay={() => {
                        setCloseRequested(false)
                        void cancelUpdateInstall()
                    }}
                    onClose={closeWhenFinished}
                />
            ) : null}
            <CommandPalette />
            <div className="visually-hidden" role="status" aria-live="polite">
                {announcement}
            </div>
        </div>
    )
}
