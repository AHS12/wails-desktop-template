/** What the tours say, and whether one is showing. */

import {create} from 'zustand'
import type {Tours} from './tour-steps'

interface TourStore {
    /** What the tours say, from the app. None means there's no tour to show. */
    tours: Tours | null
    tourOpen: boolean
    setTourOpen(open: boolean): void
}

export const useTourStore = create<TourStore>((set) => ({
    tours: null,
    tourOpen: false,
    setTourOpen: (tourOpen) => set({tourOpen}),
}))
