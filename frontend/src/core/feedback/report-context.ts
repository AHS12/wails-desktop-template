/**
 * What Report a problem can guess from where the person is, so they don't have to say.
 */

import {BUG_ACTIONS} from './report-forms'

type BugAction = (typeof BUG_ACTIONS)[number]

export interface ReportPlace {
    /** Home, or the library page: no document on screen. */
    readonly onHome: boolean
}

/** A first guess at What were you doing?, which the person can change. */
export function guessAction(place: ReportPlace): BugAction {
    return place.onHome ? 'Browsing the home page or my saved documents' : 'Editing a document'
}
