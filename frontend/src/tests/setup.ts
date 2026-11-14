import '@testing-library/jest-dom/vitest'
import {FEATURES} from '../features'
import {registerFeatures} from '../shell/feature'

// As main.tsx does, so commands, menus and settings pages include every feature.
registerFeatures(FEATURES)

// jsdom does not implement matchMedia. The theme follows the operating
// system preference, so the tests need a stand-in for it.
if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string): MediaQueryList =>
        ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }) as MediaQueryList
}
