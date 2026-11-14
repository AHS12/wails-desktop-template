/**
 * A tour's shape, and where its card goes.
 *
 * Each page has its own tour, because each has its own things to point at. What the
 * tours say belongs to the app: see example/tours.ts.
 */

export type TourPage = 'home' | 'editor'

export type TourSide = 'right' | 'left' | 'below' | 'above' | 'over'

export interface TourStep {
    /** The `data-coach` attribute of the element being pointed at. Left out, the step stands alone. */
    readonly target?: string
    readonly title: string
    readonly text: string
    /** Something to try, shown apart from the explanation. */
    readonly tryIt?: string
    readonly side: TourSide
    /** Skipped when there's nothing to point at, as when nothing has been saved yet. */
    readonly optional?: boolean
}

/** A tour for each page: its name, and its steps in order. */
export type Tours = Readonly<Record<TourPage, {readonly name: string; readonly steps: readonly TourStep[]}>>

/** The steps that have something to point at, or do not need it. */
export function availableSteps(steps: readonly TourStep[], exists: (target: string) => boolean): readonly TourStep[] {
    return steps.filter((step) => !step.optional || (step.target !== undefined && exists(step.target)))
}

export interface Box {
    readonly left: number
    readonly top: number
    readonly width: number
    readonly height: number
}

export interface CardPlace {
    readonly left: number
    readonly top: number
    /** The side the card ended up on, which is not always the one asked for. */
    readonly side: TourSide
    /** How far along the card's edge its pointer sits. */
    readonly arrow: number
}

const GAP = 14
const MARGIN = 12
const ARROW_INSET = 22

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, Math.max(low, high)))

/** Where a card goes. It stays on screen, moving to the other side of its target when it has to. */
export function placeCard(side: TourSide, target: Box | null, screen: {width: number; height: number}, card: {width: number; height: number}): CardPlace {
    const middle = {
        left: (screen.width - card.width) / 2,
        top: (screen.height - card.height) / 2,
    }
    const inside = (left: number, top: number) => ({
        left: clamp(left, MARGIN, screen.width - card.width - MARGIN),
        top: clamp(top, MARGIN, screen.height - card.height - MARGIN),
    })

    if (!target) {
        return {...inside(middle.left, middle.top), side: 'over', arrow: 0}
    }

    if (side === 'over') {
        return {
            ...inside(target.left + (target.width - card.width) / 2, target.top + (target.height - card.height) / 2),
            side: 'over',
            arrow: 0,
        }
    }

    const room: Readonly<Record<Exclude<TourSide, 'over'>, number>> = {
        right: screen.width - (target.left + target.width) - GAP - MARGIN - card.width,
        left: target.left - GAP - MARGIN - card.width,
        below: screen.height - (target.top + target.height) - GAP - MARGIN - card.height,
        above: target.top - GAP - MARGIN - card.height,
    }
    const opposite = {right: 'left', left: 'right', below: 'above', above: 'below'} as const
    const chosen = room[side] >= 0 || room[opposite[side]] < 0 ? side : opposite[side]
    const targetMiddleX = target.left + target.width / 2
    const targetMiddleY = target.top + target.height / 2

    if (chosen === 'right' || chosen === 'left') {
        const {left, top} = inside(chosen === 'right' ? target.left + target.width + GAP : target.left - GAP - card.width, targetMiddleY - card.height / 2)

        return {left, top, side: chosen, arrow: clamp(targetMiddleY - top, ARROW_INSET, card.height - ARROW_INSET)}
    }

    const {left, top} = inside(targetMiddleX - card.width / 2, chosen === 'below' ? target.top + target.height + GAP : target.top - GAP - card.height)

    return {left, top, side: chosen, arrow: clamp(targetMiddleX - left, ARROW_INSET, card.width - ARROW_INSET)}
}
