import {cleanup, render, screen, within} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {FEATURES} from '../features'
import {useUiStore} from '../store/ui-store'
import {allCommands} from './commands'
import {registerFeatures} from './feature'
import {SettingsDialog} from './SettingsDialog'

describe('an app with every optional feature left out', () => {
    beforeEach(() => registerFeatures([]))

    afterEach(() => {
        cleanup()
        useUiStore.getState().closeSettings()
        registerFeatures(FEATURES)
    })

    it('keeps the shell\'s own commands and nothing of the features', () => {
        const ids = allCommands().map((command) => command.id)

        expect(ids).toEqual(expect.arrayContaining(['new', 'save', 'undo', 'settings', 'recently-removed']))
        expect(ids).not.toEqual(expect.arrayContaining(['back-up']))
        expect(ids).not.toContain('report-problem')
        expect(ids).not.toContain('tour')
    })

    it('opens Settings without the features\' pages', () => {
        useUiStore.getState().openSettings('General')
        render(<SettingsDialog />)

        const pages = within(screen.getByRole('navigation', {name: 'Settings pages'}))

        expect(pages.getByRole('button', {name: /About/})).toBeInTheDocument()
        expect(pages.queryByRole('button', {name: /Backup/})).toBeNull()
        expect(screen.queryByText('Show the tour')).toBeNull()
    })
})

describe('the features in this app', () => {
    it('each add what they say, under ids no two share', () => {
        const ids = FEATURES.map((feature) => feature.id)
        const commands = allCommands().map((command) => command.id)

        expect(new Set(ids).size).toBe(ids.length)
        expect(new Set(commands).size).toBe(commands.length)

        for (const feature of FEATURES) {
            for (const id of Object.values(feature.menus ?? {}).flat()) {
                expect(commands, `${feature.id} puts ${id} in a menu`).toContain(id)
            }
        }
    })
})
