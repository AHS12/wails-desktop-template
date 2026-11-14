/**
 * The optional features in this app. Each is a folder of its own here.
 *
 * To leave one out, delete its line and its folder, and its Go side too where it has
 * one: docs/removing-features.md has the steps for each.
 */

import {NOTE_FORMATS} from '../example/note-export'
import {TOURS} from '../example/tours'
import type {Feature} from '../shell/feature'
import {backup} from './backup'
import {exporting} from './export'
import {report} from './report'
import {tour} from './tour'

export const FEATURES: readonly Feature[] = [
    exporting(NOTE_FORMATS),
    backup,
    report,
    tour(TOURS),
]
