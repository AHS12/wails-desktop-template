/**
 * Settings: a large window with a side list and a search box.
 *
 * Changes apply at once, with no Save button. The pages render from the settings
 * list, so adding a setting takes one entry there.
 */

import {FolderOpen, Keyboard, RotateCcw, Search, X} from 'lucide-react'
import type {LucideIcon} from 'lucide-react'
import {HardDrive, Info, Palette as PaletteIcon, Settings2, Trash2} from 'lucide-react'
import {useEffect, useMemo, useState, type ComponentType} from 'react'
import {ColourPicker} from '../components/ColourPicker'
import {Dialog, Keys, Select, Switch} from '../components/controls'
import {PropertyRow} from '../components/PropertyRow'
import {allCommands, commandForKeys, findCommand, runCommand, shortcutFor, shortcutOf} from './commands'
import {APP} from '../core/app'
import {APP_VERSION} from '../core/version'
import {SETTING_SPECS, type SettingPage, type SettingSpec} from '../core/settings/settings-spec'
import {chooseFolder} from '../platform/desktop'
import {hasDesktopStorage, libraryInfo, openLibraryFolder, type LibraryInfo} from '../platform/settings'
import {canCheckForUpdates, type ManualReason} from '../platform/update'
import {openLink} from '../platform/window'
import {documentType, useDocumentStore} from '../store/document-store'
import {useSettingsStore} from '../store/settings-store'
import {useUiStore} from '../store/ui-store'
import {REPOSITORY_URL} from '../core/app'
import {useUpdateStore} from '../store/update-store'
import {features} from './feature'
import {RemovedDocuments} from './pages/RemovedDocuments'
import {AttentionDot} from './attention'
import {SettingRow} from './SettingRow'

interface PageEntry {
    readonly id: string
    readonly icon: LucideIcon
    readonly Page?: ComponentType
    readonly useAttention?: () => string | null
}

const SHELL_PAGES: readonly PageEntry[] = [
    {id: 'General', icon: Settings2},
    {id: 'Appearance', icon: PaletteIcon},
    {id: 'Keyboard', icon: Keyboard},
    {id: 'Storage', icon: HardDrive},
    {id: 'Recently removed', icon: Trash2},
]

/** The shell's pages, then each feature's, then About. */
const pagesNow = (): readonly PageEntry[] => [...SHELL_PAGES, ...features().flatMap((feature) => feature.settingsPages ?? []), {id: 'About', icon: Info}]


const matches = (needle: string, ...texts: readonly (string | undefined)[]) =>
    texts.some((text) => text?.toLowerCase().includes(needle))

function SpecRow({spec}: {spec: SettingSpec}) {
    const value = useSettingsStore((state) => state.values[spec.key as keyof typeof state.values])
    const setValue = useSettingsStore((state) => state.setValue)
    const key = spec.key as Parameters<typeof setValue>[0]

    switch (spec.kind) {
        case 'toggle':
            return (
                <SettingRow label={spec.label} help={spec.help}>
                    <Switch label={spec.label} value={value === true} onChange={(next) => setValue(key, next)} />
                </SettingRow>
            )
        case 'choice':
            return (
                <SettingRow label={spec.label} help={spec.options.find((option) => option.value === value)?.help ?? spec.help}>
                    <Select label={spec.label} value={String(value)} options={spec.options} onChange={(next) => setValue(key, next)} />
                </SettingRow>
            )
        case 'number':
            return (
                <SettingRow label={spec.label} help={spec.help}>
                    <PropertyRow
                        label={spec.label}
                        value={Number(value)}
                        min={spec.min}
                        max={spec.max}
                        step={spec.step}
                        unit={spec.unit}
                        resetTo={spec.default}
                        onChange={(next) => setValue(key, next)}
                    />
                </SettingRow>
            )
        case 'colour':
            return (
                <SettingRow label={spec.label} help={spec.help}>
                    <ColourPicker label={spec.label} value={String(value)} onChange={(next) => setValue(key, next)} />
                </SettingRow>
            )
    }
}

/** Presses for a new shortcut. Esc cancels, and Backspace clears. */
function KeyCapture({commandId, onDone}: {commandId: string; onDone(): void}) {
    const setShortcut = useSettingsStore((state) => state.setShortcut)

    return (
        <input
            autoFocus
            readOnly
            className="key-capture"
            aria-label="Press the new keys"
            placeholder="Press keys…"
            onBlur={onDone}
            onKeyDown={(event) => {
                event.preventDefault()
                event.stopPropagation()

                if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) {
                    return
                }

                if (event.key === 'Escape') {
                    onDone()
                    return
                }

                setShortcut(commandId, event.key === 'Backspace' ? '' : shortcutOf(event.nativeEvent))
                onDone()
            }}
        />
    )
}

function KeyboardPage({needle}: {needle: string}) {
    const overrides = useSettingsStore((state) => state.shortcuts)
    const setShortcut = useSettingsStore((state) => state.setShortcut)
    const resetShortcuts = useSettingsStore((state) => state.resetShortcuts)
    const [capturing, setCapturing] = useState<string | null>(null)

    // Presets are many, so they are only shown when looked for.
    const commands = allCommands().filter((command) =>
        needle
            ? matches(needle, command.label, command.group, command.keywords, shortcutFor(command.id))
            : command.group !== 'Presets',
    )
    const groups = [...new Set(commands.map((command) => command.group))]

    return (
        <>
            <p className="settings__intro">
                Click a shortcut, then press the new keys. Backspace removes it, and Esc keeps it. Search for a preset to give it a key of its own.
            </p>
            {groups.map((group) => (
                <section key={group}>
                    <h3 className="settings__group">{group}</h3>
                    {commands
                        .filter((command) => command.group === group)
                        .map((command) => {
                            const keys = shortcutFor(command.id)
                            const clash = keys ? commandForKeys(keys) : undefined
                            const conflict = clash && clash.id !== command.id ? clash : undefined

                            return (
                                <div className="key-row" key={command.id}>
                                    <span className="key-row__label">{command.label}</span>
                                    {conflict ? (
                                        <span className="key-row__conflict" role="status">
                                            Also used by {conflict.label}
                                        </span>
                                    ) : null}
                                    {overrides[command.id] !== undefined ? (
                                        <button
                                            type="button"
                                            className="property__reset"
                                            aria-label={`Reset the shortcut for ${command.label}`}
                                            title="Reset"
                                            onClick={() => setShortcut(command.id, null)}
                                        >
                                            <RotateCcw size={12} aria-hidden="true" />
                                        </button>
                                    ) : null}
                                    {capturing === command.id ? (
                                        <KeyCapture commandId={command.id} onDone={() => setCapturing(null)} />
                                    ) : (
                                        <button
                                            type="button"
                                            className="key-row__keys"
                                            aria-label={`Change the shortcut for ${command.label}: ${keys ?? 'none'}`}
                                            onClick={() => setCapturing(command.id)}
                                        >
                                            {keys ? <Keys keys={keys} /> : <span className="key-row__none">Add</span>}
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                </section>
            ))}
            <div className="settings__page-foot">
                <button type="button" className="button" onClick={resetShortcuts}>
                    Reset all shortcuts
                </button>
            </div>
        </>
    )
}

function formatBytes(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function StoragePage() {
    const setLibraryFolder = useSettingsStore((state) => state.setLibraryFolder)
    const custom = useSettingsStore((state) => state.libraryFolder)
    const refreshDocuments = useDocumentStore((state) => state.refreshDocuments)
    const removed = useDocumentStore((state) => state.removed.length)
    const refreshRemoved = useDocumentStore((state) => state.refreshRemoved)
    const openSettings = useUiStore((state) => state.openSettings)
    const [info, setInfo] = useState<LibraryInfo | null>(null)

    const reload = () => void libraryInfo().then(setInfo, () => setInfo(null))

    useEffect(reload, [custom])

    useEffect(() => {
        void refreshRemoved()
    }, [custom, refreshRemoved])

    return (
        <>
            {hasDesktopStorage() ? (
                <>
                    <SettingRow label="Where your work is saved" help={info?.folder ?? 'Looking…'}>
                        <button type="button" className="button" onClick={() => void openLibraryFolder()}>
                            <FolderOpen size={13} aria-hidden="true" />
                            Open folder
                        </button>
                    </SettingRow>
                    <SettingRow
                        label="Change folder"
                        help={`New saves go to the new folder, and Your ${documentType.noun}s lists what is there. Anything in the old folder stays where it is.`}
                    >
                        {custom ? (
                            <button
                                type="button"
                                className="text-button"
                                onClick={() => {
                                    setLibraryFolder('')
                                    window.setTimeout(() => void refreshDocuments(), 100)
                                }}
                            >
                                Use default
                            </button>
                        ) : null}
                        <button
                            type="button"
                            className="button"
                            onClick={() =>
                                void chooseFolder(info?.folder ?? '').then((chosen) => {
                                    if (chosen) {
                                        setLibraryFolder(chosen)
                                        window.setTimeout(() => void refreshDocuments(), 100)
                                    }
                                })
                            }
                        >
                            Change…
                        </button>
                    </SettingRow>
                    <SettingRow label="Space used" help={info ? `${info.documents} ${info.documents === 1 ? documentType.noun : `${documentType.noun}s`}, with their pictures.` : undefined}>
                        <span className="tabular setting__value">{info ? formatBytes(info.bytes) : '…'}</span>
                    </SettingRow>
                    <SettingRow
                        label="Recently removed"
                        help={removed === 0 ? 'Nothing removed lately.' : `${removed} ${removed === 1 ? documentType.noun : `${documentType.noun}s`}, kept for 30 days in case you want them back.`}
                    >
                        <button type="button" className="button" onClick={() => openSettings('Recently removed')}>
                            Show
                        </button>
                    </SettingRow>
                </>
            ) : (
                <p className="settings__intro">Running in a browser, nothing is saved to disk.</p>
            )}
        </>
    )
}

/** Why an update has to be fetched by hand, and what to do. */
const MANUAL_HELP: Record<ManualReason | 'none', string> = {
    none: 'Get it from the download page, then install it over this one.',
    'move-to-applications':
        `To have ${APP.name} update itself, drag it into your Applications folder and open it from there. For now, get this version from the download page.`,
    'read-only': `${APP.name} can't change the folder it's in, so get this version from the download page and install it over this one.`,
}

function UpdateRow() {
    const update = useUpdateStore((state) => state.update)
    const {check, download, restart} = useUpdateStore.getState()

    switch (update.phase) {
        case 'idle':
            return (
                <SettingRow label="Updates" help="See whether a newer version is out.">
                    <button type="button" className="button" onClick={() => void check()}>
                        Check for updates
                    </button>
                </SettingRow>
            )
        case 'checking':
            return (
                <SettingRow label="Updates" help="Looking for a newer version…">
                    <button type="button" className="button" disabled>
                        Check for updates
                    </button>
                </SettingRow>
            )
        case 'current':
            return (
                <SettingRow label="Updates" help="You have the latest version.">
                    <button type="button" className="button" onClick={() => void check()}>
                        Check again
                    </button>
                </SettingRow>
            )
        case 'manual':
            return (
                <SettingRow label="Updates" help={`Version ${update.version} is out. ${MANUAL_HELP[update.reason ?? 'none']}`}>
                    <button type="button" className="button button--primary" onClick={() => openLink(update.releaseUrl)}>
                        Open download page
                    </button>
                </SettingRow>
            )
        case 'available':
            return (
                <SettingRow label="Updates" help={`Version ${update.version} is out.`}>
                    <button type="button" className="button button--primary" onClick={() => void download()}>
                        Download update
                    </button>
                </SettingRow>
            )
        case 'downloading':
            return (
                <SettingRow label="Updates" help={`Downloading version ${update.version}: ${Math.round(update.fraction * 100)}%`}>
                    <button type="button" className="button" disabled>
                        Download update
                    </button>
                </SettingRow>
            )
        case 'ready':
            return (
                <SettingRow label="Updates" help={`Version ${update.version} is ready. ${APP.name} will close, update itself and open again.`}>
                    <button type="button" className="button button--primary" onClick={() => void restart()}>
                        Restart to update
                    </button>
                </SettingRow>
            )
        case 'failed':
            return (
                <SettingRow label="Updates" help={update.message}>
                    <div className="setting__buttons">
                        <button type="button" className="button" onClick={() => void check()}>
                            Try again
                        </button>
                        <button type="button" className="button" onClick={() => openLink(LATEST_RELEASE_URL)}>
                            Open download page
                        </button>
                    </div>
                </SettingRow>
            )
    }
}

/** Where to get the newest version by hand, when the app can't check for itself. */
const LATEST_RELEASE_URL = `${REPOSITORY_URL}/releases/latest`

function AboutPage() {
    // Report a problem is a feature, so About offers it only when the app has it.
    const report = findCommand('report-problem')

    return (
        <>
            <SettingRow label={APP.name} help={`Version ${APP_VERSION}`}>
                <span className="tabular setting__value">Version {APP_VERSION}</span>
            </SettingRow>
            {canCheckForUpdates() ? <UpdateRow /> : null}
            <SettingRow label="Developer" help={`${APP.company}. The code, releases and issues are on GitHub.`}>
                <div className="setting__buttons">
                    <button type="button" className="button" onClick={() => openLink(REPOSITORY_URL)}>
                        github.com/{APP.repository}
                    </button>
                    {report ? (
                        <button type="button" className="button" onClick={() => runCommand(report)}>
                            {report.label}
                        </button>
                    ) : null}
                </div>
            </SettingRow>
            <SettingRow
                label="Open-source software"
                help="Built with React (MIT), HeroUI (Apache-2.0), React Aria (Apache-2.0), Lucide (ISC), Tailwind CSS (MIT), Zustand (MIT), Zod (MIT) and Wails (MIT)."
            >
                <span />
            </SettingRow>
        </>
    )
}

/** A feature's page, drawn by its own component. */
function FeaturePage({Page}: {Page: ComponentType}) {
    return <Page />
}

export function SettingsDialog() {
    const page = useUiStore((state) => state.settingsPage)
    const closeSettings = useUiStore((state) => state.closeSettings)
    const openSettings = useUiStore((state) => state.openSettings)
    const resetPage = useSettingsStore((state) => state.resetPage)
    const pages = pagesNow()
    const featurePage = pages.find((entry) => entry.id === page)?.Page
    const rows = features().flatMap((feature) => feature.settingRows ?? []).filter((row) => row.page === page)
    const [query, setQuery] = useState('')
    const needle = query.trim().toLowerCase()

    useEffect(() => {
        if (page) {
            setQuery('')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- clears on open, not on each page.
    }, [page === null])

    const found = useMemo(
        () => SETTING_SPECS.filter((spec) => matches(needle, spec.label, spec.help, 'keywords' in spec ? spec.keywords : undefined, spec.page)),
        [needle],
    )

    const specPage = (SETTING_SPECS as readonly SettingSpec[]).some((spec) => spec.page === page)

    return (
        <Dialog open={page !== null} onClose={closeSettings} label="Settings" width={860} className="settings">
            <nav className="settings__nav" aria-label="Settings pages">
                <div className="filter">
                    <Search size={13} aria-hidden="true" className="filter__icon" />
                    <input
                        autoFocus
                        className="filter__input"
                        placeholder="Search settings"
                        aria-label="Search settings"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape' && query) {
                                event.stopPropagation()
                                setQuery('')
                            }
                        }}
                    />
                </div>
                {pages.map((entry) => (
                    <button
                        key={entry.id}
                        type="button"
                        className="settings__page"
                        aria-current={!needle && page === entry.id ? 'page' : undefined}
                        onClick={() => {
                            setQuery('')
                            openSettings(entry.id)
                        }}
                    >
                        <entry.icon size={14} aria-hidden="true" />
                        {entry.id}
                        {entry.useAttention ? <AttentionDot useAttention={entry.useAttention} /> : null}
                    </button>
                ))}
            </nav>

            <div className="settings__main">
                <header className="settings__head">
                    <h2 className="settings__title">{needle ? `Results for “${query.trim()}”` : page}</h2>
                    {specPage && !needle ? (
                        <button type="button" className="text-button" onClick={() => resetPage(page as SettingPage)}>
                            Reset this page
                        </button>
                    ) : null}
                    <button type="button" className="icon-button" aria-label="Close settings" onClick={closeSettings}>
                        <X size={15} aria-hidden="true" />
                    </button>
                </header>

                <div className="settings__body">
                    {needle ? (
                        <>
                            {found.map((spec) => (
                                <SpecRow key={spec.key} spec={spec} />
                            ))}
                            {found.length === 0 ? <p className="settings__intro">No other settings match that.</p> : null}
                        </>
                    ) : page === 'Keyboard' ? (
                        <KeyboardPage needle="" />
                    ) : page === 'Storage' ? (
                        <StoragePage />
                    ) : featurePage ? (
                        <FeaturePage Page={featurePage} />
                    ) : page === 'Recently removed' ? (
                        hasDesktopStorage() ? (
                            <RemovedDocuments layout="rows" />
                        ) : (
                            <p className="settings__intro">Recently removed is only in the desktop app.</p>
                        )
                    ) : page === 'About' ? (
                        <AboutPage />
                    ) : (
                        (SETTING_SPECS as readonly SettingSpec[])
                            .filter((spec) => spec.page === page)
                            .map((spec) => <SpecRow key={spec.key} spec={spec} />)
                    )}
                    {needle ? null : rows.map(({Row}, index) => <Row key={index} />)}
                    {page === 'General' && !needle ? (
                        <SettingRow label="See what's new" help="The changes in each version.">
                            <button
                                type="button"
                                className="button"
                                onClick={() => {
                                    closeSettings()
                                    useUiStore.getState().setWhatsNewOpen(true)
                                }}
                            >
                                Show it now
                            </button>
                        </SettingRow>
                    ) : null}
                </div>
            </div>
        </Dialog>
    )
}
