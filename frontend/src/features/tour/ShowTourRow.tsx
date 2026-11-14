import {SettingRow} from '../../shell/SettingRow'
import {useUiStore} from '../../store/ui-store'
import {useTourStore} from './tour-store'

/** Settings, General: a way to see the tour again. */
export function ShowTourRow() {
    return (
        <SettingRow label="Show the tour" help="A short walk around the app.">
            <button
                type="button"
                className="button"
                onClick={() => {
                    useUiStore.getState().closeSettings()
                    useTourStore.getState().setTourOpen(true)
                }}
            >
                Show it now
            </button>
        </SettingRow>
    )
}
