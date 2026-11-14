import {Tooltip} from './controls'
import {ColourPicker} from './ColourPicker'
import {parseColourCode} from '../core/colour-code'

/** A named colour offered as a swatch. */
export interface ColourChoice {
    readonly name: string
    readonly value: string
}

/**
 * A colour on one line.
 *
 * Named swatches first, because most people know a colour by name and not by its
 * code. The last swatch opens a picker for anything else, and pasting a colour
 * code anywhere on the row uses it.
 */
export function ColourRow({
    label,
    value,
    presets,
    controlKey,
    onChange,
}: {
    label: string
    /** For the command palette to find the row by. */
    controlKey?: string
    value: string
    presets: readonly ColourChoice[]
    onChange(value: string): void
}) {
    return (
        <div className="property property--colour" data-control={controlKey}>
            <span className="property__label">{label}</span>
            <div
                className="colours"
                role="group"
                aria-label={label}
                onPaste={(event) => {
                    // The picker's own fields sit in a layer elsewhere on the page, and paste for themselves.
                    if (!event.currentTarget.contains(event.target as Node)) {
                        return
                    }

                    const colour = parseColourCode(event.clipboardData.getData('text'))

                    if (colour) {
                        event.preventDefault()
                        onChange(colour)
                    }
                }}
            >
                {presets.slice(0, 7).map((preset) => (
                    <Tooltip key={preset.value} text={preset.name} always>
                        <button
                            type="button"
                            className="colour"
                            style={{backgroundColor: preset.value}}
                            aria-label={preset.name}
                            aria-pressed={preset.value.toLowerCase() === value.toLowerCase()}
                            onClick={() => onChange(preset.value)}
                        />
                    </Tooltip>
                ))}
                <ColourPicker label={label} value={value} onChange={onChange} />
            </div>
        </div>
    )
}
