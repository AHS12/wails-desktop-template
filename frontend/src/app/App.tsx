import {useEffect, useState} from 'react'
import {commandForKeys, runCommand, shortcutOf} from '../core/commands/commands'
import {applyTheme, resolveTheme, watchSystemTheme, type ThemeChoice} from '../core/settings/theme'
import {NoteEditor} from '../example/NoteEditor'
import {CloseDialog} from '../panels/CloseDialog'
import {CommandPalette} from '../panels/CommandPalette'
import {ConfirmDialog} from '../panels/ConfirmDialog'
import {ClosingDialog} from '../panels/ClosingDialog'
import {CloudSetupDialog} from '../panels/CloudSetupDialog'
import {RestoreDialog} from '../panels/RestoreDialog'
import {clearHolding} from '../platform/backup'
import {MenuBar} from '../panels/MenuBar'
import {ReportDialog} from '../panels/ReportDialog'
import {SaveDialog} from '../panels/SaveDialog'
import {SettingsDialog} from '../panels/SettingsDialog'
import {StatusBar} from '../panels/StatusBar'
import {Toast} from '../panels/Toast'
import {Tour} from '../panels/Tour'
import {WhatsNewDialog} from '../panels/WhatsNewDialog'
import {DocumentsPage} from '../pages/DocumentsPage'
import {HomePage} from '../pages/HomePage'
import {forgetOldRemovedDocuments} from '../platform/documents'
import {hasUnsavedChanges, isHomePage, useDocumentStore} from '../store/document-store'
import {setUnsaved} from '../platform/draft'
import {setCloseToTray, setMinimiseToTray} from '../platform/window'
import {confirmClose, onCloseRequested} from '../platform/close-guard'
import {useBackupStore} from '../store/backup-store'
import {cancelUpdateInstall} from '../platform/update'
import {settingNumber, settingValue, uiScale, useSettingsStore} from '../store/settings-store'
import {useUiStore} from '../store/ui-store'
import {checkForUpdatesIfDue} from '../store/update-store'

const ROOT_FONT_PX = 16

/** Commands whose keys a text field uses for itself. An editor that wants them handles them. */
const FIELD_KEYS = new Set(['undo', 'redo'])
/** How long after start the weekly update check waits. */
const UPDATE_CHECK_DELAY_MS = 5000

/** A few seconds after start, so the first screen settles before any backup reads the disk. */
const STARTUP_BACKUP_DELAY_MS = 3000

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

    // The shell cancels the close when work is unsaved, or a backup may be due,
    // and tells us. The question is ours to ask, in our own voice; with nothing
    // unsaved there's no question, only the backup.
    const [closing, setClosing] = useState(false)

    const closeAfterBackup = () => {
        setCloseRequested(false)
        setClosing(true)
        void useBackupStore
            .getState()
            .backUpBeforeClosing()
            .finally(() => void confirmClose())
    }

    useEffect(
        () =>
            onCloseRequested(() => {
                if (hasUnsavedChanges(useDocumentStore.getState())) {
                    setCloseRequested(true)
                } else {
                    closeAfterBackup()
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
            if (documents.savePrompt || closeRequested || ui.confirm || ui.tourOpen || ui.whatsNewOpen || ui.reportOpen || ui.settingsPage) {
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
        let backupTimer: number | undefined

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
                // Whatever a restore left unpacked when the app last closed.
                void clearHolding().catch(() => undefined)

                if (values.startOn === 'last' && lastDocumentId) {
                    void useDocumentStore.getState().open(lastDocumentId)
                }

                // After the first screen has settled, so it never slows the start.
                updateTimer = window.setTimeout(() => checkForUpdatesIfDue(), UPDATE_CHECK_DELAY_MS)

                // Catches changes from a session that closed before its backup ran.
                void useBackupStore.getState().refreshBackupDue()
                backupTimer = window.setTimeout(() => void useBackupStore.getState().runAutoBackups(), STARTUP_BACKUP_DELAY_MS)
            })

        return () => {
            unsubscribe()
            unwatch()
            window.clearTimeout(updateTimer)
            window.clearTimeout(backupTimer)
        }
    }, [])

    // A save, rename or removal: back up a minute after the last one.
    useEffect(
        () =>
            useDocumentStore.subscribe((state, previous) => {
                if (state.documents !== previous.documents) {
                    useBackupStore.getState().scheduleBackups()
                }
            }),
        [],
    )

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
            <Tour />
            <Toast />
            <SaveDialog />
            <ReportDialog />
            <RestoreDialog />
            <CloudSetupDialog />
            <SettingsDialog />
            <ConfirmDialog />
            <WhatsNewDialog />
            {closeRequested ? (
                <CloseDialog
                    onStay={() => {
                        setCloseRequested(false)
                        void cancelUpdateInstall()
                    }}
                    onClose={closeAfterBackup}
                />
            ) : null}
            {closing ? <ClosingDialog /> : null}
            <CommandPalette />
            <div className="visually-hidden" role="status" aria-live="polite">
                {announcement}
            </div>
        </div>
    )
}
