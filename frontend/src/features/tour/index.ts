/**
 * The guided tour: a short walk around each page, shown once by itself and any
 * time from Help. The app says what each tour says.
 */

import './tour.css'
import {HelpCircle} from 'lucide-react'
import type {Feature} from '../../shell/feature'
import {ShowTourRow} from './ShowTourRow'
import {Tour} from './Tour'
import type {Tours} from './tour-steps'
import {useTourStore} from './tour-store'

/** The tour feature, saying what tours tells it to. */
export function tour(tours: Tours): Feature {
    useTourStore.setState({tours})

    return {
        id: 'tour',
        commands: [
            {
                id: 'tour',
                label: 'Show the tour',
                group: 'Help',
                icon: HelpCircle,
                global: true,
                keywords: 'guide tutorial beginner',
                run: () => useTourStore.getState().setTourOpen(true),
            },
        ],
        menus: {Help: ['tour']},
        settingRows: [{page: 'General', Row: ShowTourRow}],
        dialogs: [Tour],
        ownsKeyboard: () => useTourStore.getState().tourOpen,
    }
}
