import {describe, expect, it} from 'vitest'
import {DEFAULT_SETTINGS, DEFAULT_VALUES, parseSettings, SETTINGS_VERSION} from './settings-spec'

describe('reading settings', () => {
    it.each([
        ['nothing', null],
        ['not JSON', '{nope'],
        ['the wrong shape', '[1, 2]'],
        ['a newer version', JSON.stringify({version: SETTINGS_VERSION + 1, values: {reduceMotion: true}})],
    ])('gives the defaults for %s', (_, text) => {
        expect(parseSettings(text)).toEqual(DEFAULT_SETTINGS)
    })

    it('keeps good values and replaces only the bad ones', () => {
        const file = parseSettings(
            JSON.stringify({
                version: 1,
                values: {reduceMotion: true, scale: 900, theme: 'pink'},
            }),
        )

        expect(file.values.reduceMotion).toBe(true)
        expect(file.values.scale).toBe(130)
        expect(file.values.theme).toBe(DEFAULT_VALUES.theme)
    })

    it('fills in settings added since the file was written', () => {
        const file = parseSettings(JSON.stringify({version: 1, values: {}}))

        expect(file.values).toEqual(DEFAULT_VALUES)
    })

    it('drops settings it no longer knows', () => {
        const file = parseSettings(JSON.stringify({version: 1, values: {retired: true}}))

        expect(file.values).not.toHaveProperty('retired')
    })
})
