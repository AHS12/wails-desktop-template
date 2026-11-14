/**
 * What the example app's tours say: one for Home and one for the editor.
 *
 * One idea per step, what it's for before how to use it, and no word anyone would
 * have to look up. A step's target is the data-coach attribute of what it points at.
 */

import {APP} from '../core/app'
import type {Tours} from '../features/tour/tour-steps'

export const TOURS: Tours = {
    home: {
        name: 'Getting started',
        steps: [
            {
                title: `Welcome to ${APP.name}`,
                text: 'Start something new here, or carry on with something you saved.',
                side: 'over',
            },
            {
                target: 'home-start',
                title: 'Start here',
                text: 'Make a new one, or open a file from anywhere on your computer.',
                tryIt: 'After this tour, choose New.',
                side: 'below',
            },
            {
                target: 'home-draft',
                title: 'Unsaved work comes back',
                text: 'If the app closes before you save, your work waits here. Pick it up or let it go.',
                side: 'below',
                optional: true,
            },
            {
                target: 'home-recent',
                title: 'What you saved',
                text: 'What you saved last appears here. Click one to carry on with it.',
                side: 'below',
                optional: true,
            },
            {
                target: 'search',
                title: 'Find anything',
                text: 'Press Ctrl+K to search for any command or setting. You can see this tour again from Help, Show the tour.',
                side: 'below',
            },
        ],
    },
    editor: {
        name: 'The editor',
        steps: [
            {
                target: 'editor',
                title: 'Write here',
                text: 'Everything you type is kept as a draft while you work, so closing the app by mistake loses nothing.',
                side: 'over',
            },
            {
                target: 'save',
                title: 'Save it',
                text: 'Save keeps it with your other work. The arrow beside it saves a copy, or saves to a file of your own.',
                side: 'below',
            },
            {
                target: 'status',
                title: 'Where things stand',
                text: 'The bar at the bottom says whether everything is saved, and which keys do the most.',
                side: 'above',
            },
        ],
    },
}
