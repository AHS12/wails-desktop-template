/** What the status bar suggests, written with the keys the person actually has. */

import {displayKeys} from './commands'

interface HintKeys {
    readonly save?: string
    readonly palette?: string
}

/** "Ctrl+S to save · Ctrl+K to find any command". A command with no keys is left out. */
export function hintFor(keys: HintKeys): string {
    const parts = [keys.save ? `${displayKeys(keys.save)} to save` : null, keys.palette ? `${displayKeys(keys.palette)} to find any command` : null]

    return parts.filter(Boolean).join(' · ')
}
