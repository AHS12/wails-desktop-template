/**
 * The command palette: one box that finds anything.
 *
 * Empty, it offers what is useful right now. Typing searches actions, saved documents
 * and settings, in sections, and Enter acts on the top row. Searching only reads
 * lists, so it stays instant.
 */

import {Check, ChevronLeft, ChevronRight, FileText, Search, Settings2} from 'lucide-react'
import type {LucideIcon} from 'lucide-react'
import {useEffect, useMemo, useRef, useState} from 'react'
import {Dialog, Keys} from '../components/controls'
import {allCommands, findCommand, guardUnsaved, runCommand, shortcutFor, type Command} from './commands'
import {parsePrefix, rankEntries, type PaletteSection} from '../core/commands/palette-search'
import {SETTING_SPECS} from '../core/settings/settings-spec'
import {documentType, isHomePage, useDocumentStore, type DocumentStore} from '../store/document-store'
import {settingValue, useSettingsStore} from '../store/settings-store'
import {useUiStore} from '../store/ui-store'

type Section = PaletteSection | 'Right now' | 'Recent' | 'Suggested' | 'Choose one'

interface Entry {
    readonly id: string
    readonly label: string
    readonly section: Section
    readonly keywords?: string
    readonly icon?: LucideIcon
    readonly keys?: string
    /** Why it cannot run now. It stays listed, with its reason. */
    readonly reason?: string | null
    readonly note?: string
    readonly checked?: boolean
    /** Set when choosing it opens a sub-list. */
    readonly children?: () => readonly Entry[]
    readonly run?: () => void
}

const SECTION_ORDER: readonly PaletteSection[] = ['Actions', 'Documents', 'Settings']

const SUGGESTED = ['save', 'undo', 'documents']

/** Home has no document open, so it suggests ways to get one. */
const HOME_SUGGESTED = ['new', 'open-file', 'settings']

/** Commands the palette shouldn't list, since they open the palette itself. */
const HIDDEN = new Set(['palette', 'palette-alt'])

function commandEntry(command: Command, state: DocumentStore, section: Section): Entry {
    return {
        id: command.id,
        label: command.label,
        section,
        keywords: `${command.group} ${command.keywords ?? ''}`,
        icon: command.icon,
        keys: shortcutFor(command.id),
        reason: command.unavailable?.(state) ?? null,
        checked: command.checked?.(state),
        children: command.children
            ? () => command.children!(state).map((child) => commandEntry(child, state, 'Choose one'))
            : undefined,
        run: command.children ? undefined : () => runCommand(command),
    }
}

function settingEntries(): readonly Entry[] {
    const settings = useSettingsStore.getState()

    return SETTING_SPECS.map((spec): Entry => {
        const shared = {
            id: `setting-${spec.key}`,
            label: spec.label,
            section: 'Settings' as const,
            keywords: `${spec.page} ${spec.help} ${'keywords' in spec ? spec.keywords : ''}`,
            note: spec.page,
            icon: Settings2,
        }

        if (spec.kind === 'toggle') {
            const on = settingValue(spec.key) === true

            return {...shared, note: on ? 'On' : 'Off', run: () => settings.setValue(spec.key, !on)}
        }

        if (spec.kind === 'choice') {
            return {
                ...shared,
                children: () =>
                    spec.options.map(
                        (option): Entry => ({
                            id: `setting-${spec.key}-${option.value}`,
                            label: option.label,
                            section: 'Choose one',
                            checked: settingValue(spec.key) === option.value,
                            run: () => settings.setValue(spec.key, option.value),
                        }),
                    ),
            }
        }

        return {...shared, run: () => useUiStore.getState().openSettings(spec.page)}
    })
}

function allEntries(state: DocumentStore): readonly Entry[] {
    const onHome = isHomePage(state.page)
    const actions = allCommands().filter((command) => !HIDDEN.has(command.id))
        .filter((command) => !onHome || command.global)
        .map((command) => commandEntry(command, state, 'Actions'))
    const saved = state.documents.map(
        (document): Entry => ({
            id: `saved-${document.id}`,
            label: document.name,
            section: 'Documents',
            keywords: documentType.noun,
            icon: FileText,
            run: () => guardUnsaved(state, `Open “${document.name}”`, () => void state.open(document.id)),
        }),
    )

    return [...actions, ...saved, ...settingEntries()]
}

/** What an empty palette offers. */
function startingEntries(state: DocumentStore): readonly Entry[] {
    const onHome = isHomePage(state.page)
    const usable = (command: Command) => !onHome || command.global
    const relevant = allCommands().filter((command) => usable(command) && command.relevant?.(state)).map((command) =>
        commandEntry(command, state, 'Right now'),
    )
    const seen = new Set(relevant.map(({id}) => id))
    const everything = allEntries(state)
    const recent = useSettingsStore
        .getState()
        .recent.flatMap((id) => {
            const entry = everything.find((candidate) => candidate.id === id)

            return entry && !seen.has(id) ? [{...entry, section: 'Recent' as const}] : []
        })

    recent.forEach(({id}) => seen.add(id))

    const suggested = (onHome ? HOME_SUGGESTED : SUGGESTED).flatMap((id) => {
        const command = findCommand(id)

        return command && usable(command) && !seen.has(id) ? [commandEntry(command, state, 'Suggested')] : []
    })

    return [...relevant, ...recent, ...suggested]
}

function searchEntries(state: DocumentStore, query: string): readonly Entry[] {
    const {section, text} = parsePrefix(query)
    const usage = useSettingsStore.getState().usage
    const entries = allEntries(state).filter((entry) => !section || entry.section === section)

    if (text.trim() === '') {
        return entries
    }

    const ranked = rankEntries(entries, text, (entry) => usage[entry.id] ?? 0)

    // Whichever section holds the best match leads, so Enter takes the best row
    // while the rest stay in the promised order.
    const best = ranked.find((entry) => !entry.reason)?.section

    return SECTION_ORDER.flatMap((name) => {
        const rows = ranked.filter((entry) => entry.section === name)

        // Enter should not land on a row that can only explain itself.
        return [...rows.filter((entry) => !entry.reason), ...rows.filter((entry) => entry.reason)]
    }).sort((a, b) => Number(b.section === best) - Number(a.section === best))
}

export function CommandPalette() {
    const open = useUiStore((state) => state.paletteOpen)
    const setOpen = useUiStore((state) => state.setPaletteOpen)
    const [query, setQuery] = useState('')
    const [active, setActive] = useState(0)
    const [stack, setStack] = useState<readonly Entry[]>([])
    const [notice, setNotice] = useState<string | null>(null)
    const list = useRef<HTMLDivElement>(null)

    const sub = stack[stack.length - 1]

    const results = useMemo(() => {
        if (!open) {
            return []
        }

        const state = useDocumentStore.getState()

        if (sub) {
            const items = sub.children!()

            return query.trim() ? rankEntries(items, query) : items
        }

        return query === '' ? startingEntries(state) : searchEntries(state, query)
    }, [open, query, sub])

    useEffect(() => {
        if (open) {
            setQuery('')
            setActive(0)
            setStack([])
            setNotice(null)
        }
    }, [open])

    useEffect(() => {
        setActive(0)
        setNotice(null)
    }, [query, sub])

    useEffect(() => {
        list.current?.querySelector('[data-active="true"]')?.scrollIntoView({block: 'nearest'})
    }, [active])

    const choose = (entry: Entry | undefined) => {
        if (!entry) {
            return
        }

        if (entry.reason) {
            setNotice(entry.reason)
            return
        }

        if (entry.children) {
            setStack([...stack, entry])
            setQuery('')
            return
        }

        useSettingsStore.getState().noteUsed(stack[0]?.id ?? entry.id)
        setOpen(false)
        entry.run?.()
    }

    let lastSection: Section | null = null

    return (
        <Dialog open={open} onClose={() => setOpen(false)} label="Command palette" width={600} position="top" className="palette">
            <div className="palette__search">
                {sub ? (
                    <button type="button" className="palette__back" aria-label="Back" onClick={() => setStack(stack.slice(0, -1))}>
                        <ChevronLeft size={15} aria-hidden="true" />
                        {sub.label}
                    </button>
                ) : (
                    <Search size={15} aria-hidden="true" className="palette__search-icon" />
                )}
                <input
                    autoFocus
                    className="palette__input"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="palette-list"
                    aria-activedescendant={results[active] ? `palette-${active}` : undefined}
                    aria-label="Search commands, saved work and settings"
                    placeholder={sub ? 'Choose one' : 'Search commands, saved work, settings…'}
                    value={query}
                    spellCheck={false}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowDown') {
                            event.preventDefault()
                            setActive((current) => Math.min(current + 1, results.length - 1))
                        } else if (event.key === 'ArrowUp') {
                            event.preventDefault()
                            setActive((current) => Math.max(current - 1, 0))
                        } else if (event.key === 'Enter') {
                            event.preventDefault()
                            choose(results[active])
                        } else if (event.key === 'Backspace' && query === '' && sub) {
                            event.preventDefault()
                            setStack(stack.slice(0, -1))
                        } else if (event.key === 'Escape' && sub) {
                            event.preventDefault()
                            event.stopPropagation()
                            setStack(stack.slice(0, -1))
                        }
                    }}
                />
            </div>

            <div className="palette__list" id="palette-list" role="listbox" aria-label="Results" ref={list}>
                {results.length === 0 ? <p className="palette__empty">Nothing matches that. Try a shorter word.</p> : null}
                {results.map((entry, index) => {
                    const heading = !sub && entry.section !== lastSection ? entry.section : null
                    const Icon = entry.icon

                    lastSection = entry.section

                    return (
                        <div key={`${entry.section}-${entry.id}`} role="presentation">
                            {heading ? (
                                <div className="palette__heading" role="presentation">
                                    {heading}
                                </div>
                            ) : null}
                            <button
                                type="button"
                                id={`palette-${index}`}
                                role="option"
                                tabIndex={-1}
                                aria-selected={index === active}
                                aria-disabled={entry.reason ? true : undefined}
                                className="palette__row"
                                data-active={index === active}
                                data-unavailable={entry.reason ? true : undefined}
                                onMouseMove={() => setActive(index)}
                                onClick={() => choose(entry)}
                            >
                                <span className="palette__icon" aria-hidden="true">
                                    {entry.checked ? <Check size={14} /> : Icon ? <Icon size={14} /> : null}
                                </span>
                                <span className="palette__label">{entry.label}</span>
                                {entry.reason ? <span className="palette__reason">{entry.reason}</span> : null}
                                {!entry.reason && entry.note ? <span className="palette__note">{entry.note}</span> : null}
                                {entry.keys ? <Keys keys={entry.keys} /> : null}
                                {entry.children ? <ChevronRight size={13} aria-hidden="true" className="palette__more" /> : null}
                            </button>
                        </div>
                    )
                })}
            </div>

            <div className="palette__foot">
                {notice ? (
                    <span className="palette__notice" role="status">
                        {notice}
                    </span>
                ) : (
                    <>
                        <span><kbd className="keys">↑↓</kbd> move</span>
                        <span><kbd className="keys">Enter</kbd> run</span>
                        <span className="palette__prefixes">
                            <kbd className="keys">&gt;</kbd> actions <kbd className="keys">@</kbd> {documentType.noun}s
                        </span>
                    </>
                )}
            </div>
        </Dialog>
    )
}
