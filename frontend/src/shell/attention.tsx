/** A dot that says something needs a look, such as a backup that keeps failing. */

import {features} from './feature'

/** The dot for one feature page. A component of its own, so its hook is called once, always. */
export function AttentionDot({useAttention, label = 'Needs attention'}: {useAttention: () => string | null; label?: string}) {
    const attention = useAttention()

    return attention ? <span className="attention-dot" role="img" aria-label={label} title={attention} /> : null
}

/** Dots for every feature page that needs a look, as beside Settings in the menu. */
export function FeatureAttention() {
    return (
        <>
            {features()
                .flatMap((feature) => feature.settingsPages ?? [])
                .map((page) => (page.useAttention ? <AttentionDot key={page.id} useAttention={page.useAttention} label={`${page.id} needs attention`} /> : null))}
        </>
    )
}
