/**
 * Every setting, as data.
 *
 * The settings page and the palette both render from this list, so adding a
 * setting takes one entry. A setting is listed only once the feature it controls
 * works.
 */

import {z} from 'zod'
import {APP} from '../app'
import type {DocumentSort} from '../library/document-summary'

export type SettingPage = 'General' | 'Appearance'

export const SETTING_PAGES: readonly SettingPage[] = ['General', 'Appearance']

interface Common {
    readonly key: string
    readonly page: SettingPage
    readonly label: string
    readonly help: string
    readonly keywords?: string
    /** Only offered where the system shows tray icons, which GNOME doesn't. */
    readonly needsTray?: boolean
}

export interface ToggleSetting extends Common {
    readonly kind: 'toggle'
    readonly default: boolean
}

export interface ChoiceSetting extends Common {
    readonly kind: 'choice'
    readonly default: string
    /** An option's help, when there is one, replaces the setting's own while it's chosen. */
    readonly options: readonly {readonly value: string; readonly label: string; readonly help?: string}[]
}

export interface NumberSetting extends Common {
    readonly kind: 'number'
    readonly default: number
    readonly min: number
    readonly max: number
    readonly step: number
    readonly unit?: string
}

export interface ColourSetting extends Common {
    readonly kind: 'colour'
    readonly default: string
}

export type SettingSpec = ToggleSetting | ChoiceSetting | NumberSetting | ColourSetting

export const SETTING_SPECS = [
    {
        key: 'startOn',
        page: 'General',
        kind: 'choice',
        label: 'Start on',
        help: 'What you see when the app opens.',
        default: 'home',
        options: [
            {value: 'home', label: 'Home'},
            {value: 'last', label: 'Last document'},
        ],
    },
    {
        key: 'autosaveDelay',
        page: 'General',
        kind: 'choice',
        label: 'Autosave',
        help: 'How soon after a change your draft is written, so a crash cannot take your work.',
        keywords: 'draft interval',
        default: '600',
        options: [
            {value: '600', label: 'Right away'},
            {value: '5000', label: 'After 5 seconds'},
            {value: '30000', label: 'After 30 seconds'},
        ],
    },
    {
        key: 'confirmRemove',
        page: 'General',
        kind: 'toggle',
        label: 'Confirm before removing a document',
        help: 'Ask first. Off by default, because a removed document waits in Recently removed for 30 days.',
        keywords: 'delete',
        default: false,
    },
    {
        key: 'showWhatsNew',
        page: 'General',
        kind: 'toggle',
        label: "Show what's new after an update",
        help: 'Opens the list of changes once, the first time a new version starts.',
        keywords: 'changelog release notes version',
        default: true,
    },
    {
        key: 'checkUpdates',
        page: 'General',
        kind: 'toggle',
        label: 'Check for updates automatically',
        help: 'Once a week, when the app opens. It tells you when a new version is out, and never downloads anything by itself.',
        keywords: 'update upgrade new version github',
        default: true,
    },
    {
        key: 'closeButton',
        page: 'General',
        kind: 'choice',
        label: 'Close button',
        help: 'What happens when you close the window.',
        needsTray: true,
        keywords: 'tray taskbar background hide exit quit system',
        default: 'quit',
        options: [
            {value: 'quit', label: `Quits ${APP.name}`, help: `Closing the window quits ${APP.name}. It asks first if anything is unsaved.`},
            {
                value: 'tray',
                label: 'Keeps it running',
                help: `Closing the window hides it, and ${APP.name} keeps running in the tray, or in the menu bar at the top of the screen on a Mac. Click its icon there to bring it back. Quit in the File menu closes it for good.`,
            },
        ],
    },
    {
        key: 'minimiseButton',
        page: 'General',
        kind: 'choice',
        label: 'Minimise button',
        help: 'What happens when you minimise the window.',
        needsTray: true,
        keywords: 'tray taskbar background hide minimize system',
        default: 'taskbar',
        options: [
            {value: 'taskbar', label: 'Puts it on the taskbar', help: 'Minimising puts the window on the taskbar, or in the Dock on a Mac, as usual.'},
            {
                value: 'tray',
                label: 'Hides it in the tray',
                help: `Minimising hides the window, off the taskbar, and ${APP.name} waits in the tray, or in the menu bar at the top of the screen on a Mac. Click its icon there to bring it back.`,
            },
        ],
    },
    {
        key: 'theme',
        page: 'Appearance',
        kind: 'choice',
        label: 'Theme',
        help: 'Follow your system, or always use one.',
        keywords: 'dark light mode',
        default: 'system',
        options: [
            {value: 'system', label: 'System'},
            {value: 'dark', label: 'Dark'},
            {value: 'light', label: 'Light'},
        ],
    },
    {
        key: 'scale',
        page: 'Appearance',
        kind: 'number',
        label: 'Interface scale',
        help: 'Makes the whole interface larger or smaller.',
        keywords: 'zoom size text',
        default: 100,
        min: 90,
        max: 130,
        step: 10,
        unit: '%',
    },
    {
        key: 'reduceMotion',
        page: 'Appearance',
        kind: 'toggle',
        label: 'Reduce motion',
        help: 'Turns off interface animation. Your system setting is respected either way.',
        keywords: 'animation accessibility',
        default: false,
    },
    {
        key: 'helpOnHover',
        page: 'Appearance',
        kind: 'toggle',
        label: 'Show help on hover',
        help: 'Explains a control when you rest the pointer on its name.',
        keywords: 'tooltip',
        default: true,
    },
] as const satisfies readonly SettingSpec[]

export type SettingKey = (typeof SETTING_SPECS)[number]['key']

export type SettingValue = boolean | number | string

export type SettingValues = Readonly<Record<SettingKey, SettingValue>>

export const DEFAULT_VALUES = Object.fromEntries(
    SETTING_SPECS.map((spec) => [spec.key, spec.default]),
) as unknown as SettingValues

/** The current settings file's shape. Bump when a change cannot be read as-is. */
export const SETTINGS_VERSION = 1

export interface SettingsFile {
    readonly version: number
    readonly values: SettingValues
    /** Command id to the keys the user chose. An empty string means no shortcut. */
    readonly shortcuts: Readonly<Record<string, string>>
    /** Commands run recently, newest first. */
    readonly recent: readonly string[]
    /** How often each palette entry was chosen, to rank between similar scores. */
    readonly usage: Readonly<Record<string, number>>
    readonly tourSeen: boolean
    readonly homeTourSeen: boolean
    /** The version whose What's new was last closed. */
    readonly lastSeenVersion: string
    /** The document in hand when the app last closed, for "Start on: last document". */
    readonly lastDocumentId: string | null
    readonly libraryFolder: string
    /** When updates were last looked for successfully, in milliseconds. 0 for never. */
    readonly lastUpdateCheck: number
    /** Colours picked lately in any colour picker, newest first. */
    readonly recentColours: readonly string[]
    /** The user's own palette, shown in every colour picker. */
    readonly myColours: readonly string[]
    /** How the library page is sorted. */
    readonly documentsSort: DocumentSort
    readonly folderBackup: FolderBackupSettings
    readonly cloudBackup: CloudBackupSettings
}

/**
 * Where cloud backups go. None of it is secret: the keys are in the system's
 * keychain, never here, since this file is also copied into the browser's storage.
 */
export interface CloudBackupSettings {
    /** The service picked in the setup, or empty when cloud backup isn't set up. */
    readonly service: string
    readonly endpoint: string
    readonly region: string
    readonly bucket: string
    /** Where in the bucket the backup lives. */
    readonly folder: string
    /** The bucket in the path rather than the address, as every service but Amazon gets. */
    readonly pathStyle: boolean
    /** When the last backup to the cloud finished, as an ISO time. */
    readonly lastAt: string
    /** Back up by itself, a minute after a change, at start and at close. */
    readonly auto: boolean
    /** What the documents were at the last cloud backup, to tell whether anything changed. */
    readonly lastFingerprint: string
    /** When automatic backups started failing, as an ISO time, or empty while they work. */
    readonly failingSince: string
}

export const DEFAULT_CLOUD_BACKUP: CloudBackupSettings = {
    service: '',
    endpoint: '',
    region: '',
    bucket: '',
    folder: APP.id,
    pathStyle: true,
    lastAt: '',
    auto: true,
    lastFingerprint: '',
    failingSince: '',
}

/** Backing up to a folder by itself, once a day when something changed. */
export interface FolderBackupSettings {
    /** Where the dated backups go. Empty when it's off. */
    readonly folder: string
    /** How many of the app's own backups to keep there. */
    readonly keep: number
    /** The local day of the last backup there, as 2026-11-04. */
    readonly lastDay: string
    /** What the documents were at the last backup, to tell whether anything changed. */
    readonly lastFingerprint: string
    /** When the last backup there was made, as an ISO time. */
    readonly lastAt: string
}

export const DEFAULT_FOLDER_BACKUP: FolderBackupSettings = {folder: '', keep: 10, lastDay: '', lastFingerprint: '', lastAt: ''}

export const DEFAULT_SETTINGS: SettingsFile = {
    version: SETTINGS_VERSION,
    values: DEFAULT_VALUES,
    shortcuts: {},
    recent: [],
    usage: {},
    tourSeen: false,
    homeTourSeen: false,
    lastSeenVersion: '',
    lastDocumentId: null,
    libraryFolder: '',
    lastUpdateCheck: 0,
    recentColours: [],
    myColours: [],
    documentsSort: 'changed',
    folderBackup: DEFAULT_FOLDER_BACKUP,
    cloudBackup: DEFAULT_CLOUD_BACKUP,
}

/** A setting's value if it is valid for its spec, otherwise its default. */
export function validSettingValue(spec: SettingSpec, value: unknown): SettingValue {
    switch (spec.kind) {
        case 'toggle':
            return typeof value === 'boolean' ? value : spec.default
        case 'choice':
            return spec.options.some((option) => option.value === value) ? (value as string) : spec.default
        case 'number':
            return typeof value === 'number' && Number.isFinite(value)
                ? Math.min(spec.max, Math.max(spec.min, value))
                : spec.default
        case 'colour':
            return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : spec.default
    }
}

/** Codes in any other form are dropped, so a hand-edited file can't break a picker. */
const colourList = z
    .array(z.unknown())
    .catch([])
    .transform((codes) => [
        ...new Set(
            codes
                .filter((code): code is string => typeof code === 'string')
                .map((code) => code.toLowerCase())
                .filter((code) => /^#[0-9a-f]{6}$/.test(code)),
        ),
    ])

const fileSchema = z.object({
    version: z.number(),
    values: z.record(z.string(), z.unknown()).catch({}),
    shortcuts: z.record(z.string(), z.string()).catch({}),
    recent: z.array(z.string()).catch([]),
    usage: z.record(z.string(), z.number()).catch({}),
    tourSeen: z.boolean().catch(false),
    homeTourSeen: z.boolean().catch(false),
    lastSeenVersion: z.string().catch(''),
    lastDocumentId: z.string().nullable().catch(null),
    libraryFolder: z.string().catch(''),
    lastUpdateCheck: z.number().catch(0),
    recentColours: colourList,
    myColours: colourList,
    documentsSort: z.enum(['changed', 'name', 'made']).catch('changed'),
    folderBackup: z
        .object({
            folder: z.string().catch(''),
            keep: z.number().int().min(1).max(100).catch(10),
            lastDay: z.string().catch(''),
            lastFingerprint: z.string().catch(''),
            lastAt: z.string().catch(''),
        })
        .catch(DEFAULT_FOLDER_BACKUP),
    cloudBackup: z
        .object({
            service: z.string().catch(''),
            endpoint: z.string().catch(''),
            region: z.string().catch(''),
            bucket: z.string().catch(''),
            folder: z.string().catch(APP.id),
            pathStyle: z.boolean().catch(true),
            lastAt: z.string().catch(''),
            auto: z.boolean().catch(true),
            lastFingerprint: z.string().catch(''),
            failingSince: z.string().catch(''),
        })
        .catch(DEFAULT_CLOUD_BACKUP),
})

/** Never throws: a damaged or foreign file gives the defaults. */
export function parseSettings(text: string | null): SettingsFile {
    if (!text) {
        return DEFAULT_SETTINGS
    }

    try {
        const file = fileSchema.parse(JSON.parse(text))

        // A newer build's file might mean something else by the same names.
        if (file.version > SETTINGS_VERSION) {
            return DEFAULT_SETTINGS
        }

        const values = Object.fromEntries(
            SETTING_SPECS.map((spec) => [spec.key, validSettingValue(spec, file.values[spec.key])]),
        ) as unknown as SettingValues

        return {...file, version: SETTINGS_VERSION, values}
    } catch {
        return DEFAULT_SETTINGS
    }
}
