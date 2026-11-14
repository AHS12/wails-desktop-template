/** One row of a settings page: what it is on the left, the control on the right. */

import type {ReactNode} from 'react'

export function SettingRow({label, help, children}: {label: string; help?: string; children: ReactNode}) {
    return (
        <div className="setting">
            <div className="setting__text">
                <div className="setting__label">{label}</div>
                {help ? <div className="setting__help">{help}</div> : null}
            </div>
            <div className="setting__control">{children}</div>
        </div>
    )
}
