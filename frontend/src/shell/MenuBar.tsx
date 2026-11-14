/**
 * The menu bar, which is also the window's title bar.
 *
 * Menus make every feature discoverable. Every item comes from the command registry,
 * so a menu can never disagree with the palette or the keys.
 */

import {Dropdown} from '@heroui/react'
import {AppWindow, Check, ChevronDown, ChevronRight, Copy, Minus, Save, Search, Square, X} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import {Keys} from '../components/controls'
import {findCommand, runCommand, shortcutFor, type Command} from './commands'
import {APP} from '../core/app'
import {APP_VERSION} from '../core/version'
import {closeWindow, hasInsetTitleBar, hasWindowControls, minimiseWindow, toggleMaximiseWindow, windowIsMaximised} from '../platform/window'
import {FeatureAttention} from './attention'
import {features, type MenuTitle} from './feature'
import {hasUnsavedChanges, isHomePage, useDocumentStore} from '../store/document-store'
import {useUiStore} from '../store/ui-store'

/** Where a menu takes the items features add, each feature's as a group of its own. */
const FEATURE_ITEMS = 'features'

/** A menu is command ids, with null for a divider. */
const MENUS: readonly {readonly title: MenuTitle; readonly items: readonly (string | null)[]}[] = [
    {
        title: 'File',
        items: ['new', null, 'home', 'documents', 'open-file', null, 'save', 'save-copy', 'save-to-file', FEATURE_ITEMS, null, 'settings', null, 'quit'],
    },
    {
        title: 'Edit',
        items: ['undo', 'redo', FEATURE_ITEMS],
    },
    {
        title: 'View',
        items: ['theme', FEATURE_ITEMS],
    },
    {
        title: 'Help',
        items: ['palette', 'shortcuts', FEATURE_ITEMS, 'whats-new', null, 'check-updates', 'about'],
    },
]

/** A menu's items with each feature's group in its place, set off by dividers. */
function itemsOf(title: MenuTitle, items: readonly (string | null)[]): (string | null)[] {
    const groups = features().flatMap((feature) => (feature.menus?.[title]?.length ? [feature.menus[title]] : []))

    return items.flatMap((item) => (item === FEATURE_ITEMS ? groups.flatMap((group) => [null, ...group]) : [item]))
}

function ItemBody({command, children}: {command: Command; children?: boolean}) {
    const state = useDocumentStore.getState()
    const Icon = command.icon
    const keys = shortcutFor(command.id)
    const reason = command.unavailable?.(state)

    return (
        <>
            <span className="menu-item__icon" aria-hidden="true">
                {command.checked?.(state) ? <Check size={13} /> : Icon ? <Icon size={13} /> : null}
            </span>
            <span className="menu-item__label" title={reason ?? undefined}>
                {command.label}
                {command.id === 'settings' ? <FeatureAttention /> : null}
            </span>
            {keys ? <Keys keys={keys} /> : null}
            {children ? <ChevronRight className="menu-item__more" size={13} aria-hidden="true" /> : null}
        </>
    )
}

function MenuEntries({items, onDone}: {items: readonly (string | null)[]; onDone(): void}) {
    // A menu shows the state as it is now, so it follows the store while open.
    const state = useDocumentStore()

    return (
        <Dropdown.Menu
            className="menu-list"
            onAction={(id) => {
                const command = findCommand(String(id), state)

                if (command) {
                    onDone()
                    runCommand(command)
                }
            }}
            disabledKeys={items.flatMap((id) => {
                const command = id ? findCommand(id) : undefined

                // The home page has no prop on screen to act on.
                const off = command && ((isHomePage(state.page) && !command.global) || command.unavailable?.(state))

                return off ? [command.id] : []
            })}
        >
            {items.map((id, index) => {
                if (id === null) {
                    return <Dropdown.Item key={`divider-${index}`} id={`divider-${index}`} isDisabled className="menu-divider" textValue="" aria-hidden="true" />
                }

                const command = findCommand(id)

                if (!command) {
                    return null
                }

                if (command.children) {
                    return (
                        <Dropdown.SubmenuTrigger key={id}>
                            <Dropdown.Item id={id} textValue={command.label} className="menu-item">
                                <ItemBody command={command} children />
                            </Dropdown.Item>
                            <Dropdown.Popover className="menu-popover" placement="right top">
                                <Dropdown.Menu
                                    className="menu-list"
                                    onAction={(childId) => {
                                        const child = command.children!(state).find((entry) => entry.id === childId)

                                        if (child) {
                                            onDone()
                                            runCommand(child)
                                        }
                                    }}
                                >
                                    {command.children(state).map((child) => (
                                        <Dropdown.Item key={child.id} id={child.id} textValue={child.label} className="menu-item">
                                            <ItemBody command={child} />
                                        </Dropdown.Item>
                                    ))}
                                </Dropdown.Menu>
                            </Dropdown.Popover>
                        </Dropdown.SubmenuTrigger>
                    )
                }

                return (
                    <Dropdown.Item key={id} id={id} textValue={command.label} className="menu-item">
                        <ItemBody command={command} />
                    </Dropdown.Item>
                )
            })}
        </Dropdown.Menu>
    )
}

function Menus() {
    const [open, setOpen] = useState<string | null>(null)

    return (
        <nav className="menus" aria-label="Menu">
            {MENUS.map(({title, items}) => (
                <Dropdown
                    key={title}
                    isOpen={open === title}
                    onOpenChange={(next) => setOpen(next ? title : (current) => (current === title ? null : current))}
                >
                    <Dropdown.Trigger
                        className="menu-button"
                        data-open={open === title}
                        // Moving along the bar with one open switches menus, as a real menu bar does.
                        onHoverStart={() => setOpen((current) => (current && current !== title ? title : current))}
                    >
                        {title}
                        {/* Settings is in the File menu, so its dot shows there before the menu opens. */}
                        {title === 'File' ? <FeatureAttention /> : null}
                    </Dropdown.Trigger>
                    <Dropdown.Popover className="menu-popover" placement="bottom start" offset={2} isNonModal>
                        <MenuEntries items={itemsOf(title, items)} onDone={() => setOpen(null)} />
                    </Dropdown.Popover>
                </Dropdown>
            ))}
        </nav>
    )
}

/** The other ways to save, under the arrow beside Save, where people look when they want to keep something. */
const SAVE_MORE: readonly (string | null)[] = ['save-copy', 'save-to-file']

function SaveButton() {
    const save = useDocumentStore((state) => state.save)
    const [open, setOpen] = useState(false)

    return (
        <span className="split-button" data-coach="save">
            <button type="button" className="button" onClick={() => void save()} title={`Save (${shortcutFor('save') ?? ''})`}>
                <Save size={13} aria-hidden="true" />
                Save
            </button>
            <Dropdown isOpen={open} onOpenChange={setOpen}>
                <Dropdown.Trigger className="button split-button__more" aria-label="More ways to save" data-open={open}>
                    <ChevronDown size={13} aria-hidden="true" />
                </Dropdown.Trigger>
                <Dropdown.Popover className="menu-popover" placement="bottom end" offset={4}>
                    <MenuEntries items={SAVE_MORE} onDone={() => setOpen(false)} />
                </Dropdown.Popover>
            </Dropdown>
        </span>
    )
}

/** The document's name: click to rename it where it is. A dot marks unsaved changes. */
function DocumentName() {
    const name = useDocumentStore((state) => state.name)
    const setName = useDocumentStore((state) => state.setName)
    const dirty = useDocumentStore(hasUnsavedChanges)
    const neverSaved = useDocumentStore((state) => state.currentId === null && state.filePath === null)
    const [draft, setDraft] = useState<string | null>(null)
    const input = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (draft !== null) {
            input.current?.select()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only when editing starts.
    }, [draft === null])

    if (draft !== null) {
        const finish = () => {
            if (draft.trim()) {
                setName(draft.trim())
            }

            setDraft(null)
        }

        return (
            <input
                ref={input}
                className="prop-name__input"
                aria-label="Name"
                value={draft}
                maxLength={60}
                spellCheck={false}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={finish}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        finish()
                    } else if (event.key === 'Escape') {
                        event.stopPropagation()
                        setDraft(null)
                    }
                }}
            />
        )
    }

    return (
        <button type="button" className="prop-name" title="Rename" onClick={() => setDraft(name)}>
            <span className="prop-name__text">{name}</span>
            <span className="prop-name__dot" data-dirty={dirty} role="img" aria-label={dirty ? 'Unsaved changes' : neverSaved ? 'Not saved yet' : 'Saved'} />
        </button>
    )
}

function WindowControls() {
    const [maximised, setMaximised] = useState(false)

    useEffect(() => {
        const check = () => void windowIsMaximised().then(setMaximised)

        check()
        window.addEventListener('resize', check)

        return () => window.removeEventListener('resize', check)
    }, [])

    if (!hasWindowControls()) {
        return null
    }

    return (
        <div className="window-controls">
            <button type="button" className="window-control" aria-label="Minimise" onClick={minimiseWindow}>
                <Minus size={14} aria-hidden="true" strokeWidth={1.4} />
            </button>
            <button type="button" className="window-control" aria-label={maximised ? 'Restore' : 'Maximise'} onClick={toggleMaximiseWindow}>
                {maximised ? <Copy size={11} aria-hidden="true" strokeWidth={1.4} /> : <Square size={11} aria-hidden="true" strokeWidth={1.4} />}
            </button>
            <button type="button" className="window-control window-control--close" aria-label="Close" onClick={closeWindow}>
                <X size={15} aria-hidden="true" strokeWidth={1.4} />
            </button>
        </div>
    )
}

export function MenuBar({home}: {home?: boolean}) {
    const setPaletteOpen = useUiStore((state) => state.setPaletteOpen)
    const showHome = useDocumentStore((state) => state.showHome)

    return (
        <header className="menubar" data-inset={hasInsetTitleBar()}>
            <button type="button" className="menubar__brand" aria-label="Home" title="Home" onClick={showHome}>
                <AppWindow size={15} aria-hidden="true" />
            </button>
            <Menus />
            {home ? (
                <span className="menubar__app">
                    {APP.name} <span className="tabular">v{APP_VERSION}</span>
                </span>
            ) : (
                <DocumentName />
            )}
            <span className="menubar__drag" />
            <button type="button" className="palette-button" data-coach="search" onClick={() => setPaletteOpen(true)}>
                <Search size={13} aria-hidden="true" />
                <span>Search or run…</span>
                <Keys keys={shortcutFor('palette') ?? 'Ctrl+K'} />
            </button>
            <span className="menubar__drag" />
            {home ? null : <SaveButton />}
            <WindowControls />
        </header>
    )
}
