/** What a note can be exported as. A new app lists its own formats here. */

import type {ExportFormat} from '../features/export/formats'
import type {Note} from './note'

export const NOTE_FORMATS: readonly ExportFormat<Note>[] = [
    {
        id: 'markdown',
        label: 'Markdown',
        extension: 'md',
        help: 'Opens in most note and writing apps, with the name as its heading.',
        make: (note, name) => `# ${name}\n\n${note.text}${note.text.endsWith('\n') ? '' : '\n'}`,
    },
    {
        id: 'text',
        label: 'Plain text',
        extension: 'txt',
        help: 'Just the words, for anything that reads text.',
        make: (note) => note.text,
    },
]
