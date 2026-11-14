/**
 * The questions Report a problem asks: the GitHub issue templates, written out.
 *
 * Every id, label and option here is the template's own, word for word, because
 * GitHub fills a form field only from an exact match and ignores anything else
 * without a word. A test reads the templates and checks this list against them.
 */

export type ReportKind = 'bug' | 'feature'

export interface ReportField {
    /** The template's `id`. */
    readonly id: string
    readonly label: string
    readonly type: 'dropdown' | 'textarea' | 'input'
    readonly required: boolean
    readonly options?: readonly string[]
    readonly description?: string
    readonly placeholder?: string
    /** Filled in by the app and shown under What will be shared, not asked. */
    readonly filledIn?: boolean
}

export interface ReportForm {
    readonly kind: ReportKind
    /** What the choice at the top of the dialog says. */
    readonly choice: string
    /** The template's file in `.github/ISSUE_TEMPLATE`. */
    readonly template: string
    /** The template's title, which the person's own words follow. */
    readonly titlePrefix: string
    readonly fields: readonly ReportField[]
}

export const BUG_ACTIONS = [
    'Installing or opening the app',
    'Browsing the home page or my saved documents',
    'Editing a document',
    'Saving or opening a document',
    'Exporting',
    'Backing up or restoring',
    'Changing settings or the interface scale',
    'Something else',
] as const

export const SYSTEMS = [
    'Windows 11',
    'Windows 10',
    'Mac with Apple silicon',
    'Mac with Intel',
    'Built from source on another system',
] as const

export const REPORT_FORMS: readonly ReportForm[] = [
    {
        kind: 'bug',
        choice: 'Something’s wrong',
        template: 'bug_report.yml',
        titlePrefix: '[Bug]: ',
        fields: [
            {id: 'action', label: 'What were you doing?', type: 'dropdown', required: true, options: BUG_ACTIONS},
            {id: 'what-happened', label: 'What happened?', type: 'textarea', required: true, description: 'Include what you expected to happen instead.'},
            {
                id: 'steps',
                label: 'How can we make it happen?',
                type: 'textarea',
                required: true,
                placeholder: '1. Open a saved document\n2. Choose Export\n3. Pick a folder',
            },
            {id: 'frequency', label: 'How often does it happen?', type: 'dropdown', required: true, options: ['Every time', 'Sometimes', 'Only once so far']},
            {id: 'version', label: 'App version', type: 'input', required: true, filledIn: true},
            {id: 'system', label: 'System', type: 'dropdown', required: true, options: SYSTEMS, filledIn: true},
        ],
    },
    {
        kind: 'feature',
        choice: 'An idea',
        template: 'feature_request.yml',
        titlePrefix: '[Feature]: ',
        fields: [
            {
                id: 'area',
                label: 'Which part of the app is it about?',
                type: 'dropdown',
                required: true,
                options: ['Home page and saved documents', 'Editing', 'Export', 'Backup', 'Settings and shortcuts', 'Something else'],
            },
            {
                id: 'problem',
                label: 'What are you trying to do?',
                type: 'textarea',
                required: true,
                description: 'The goal or problem matters more than the solution.',
            },
            {id: 'idea', label: 'What would you like to happen?', type: 'textarea', required: true},
            {id: 'today', label: 'What do you do today instead?', type: 'textarea', required: false},
        ],
    },
]

export const formOf = (kind: ReportKind): ReportForm => REPORT_FORMS.find((form) => form.kind === kind)!
