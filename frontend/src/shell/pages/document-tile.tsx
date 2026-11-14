/** A saved document's picture, shared by Home and the library. */

import {useState} from 'react'
import type {SavedDocument} from '../../platform/documents'
import {DOCUMENT_ICON} from './document-labels'

/** The document's picture, or its icon when it has none or the picture won't load. */
export function DocumentPicture({document, iconSize = 30}: {document: SavedDocument; iconSize?: number}) {
    const [failed, setFailed] = useState<string | null>(null)
    const Icon = DOCUMENT_ICON

    return document.thumbnail && failed !== document.thumbnail ? (
        <img src={document.thumbnail} alt="" draggable={false} loading="lazy" decoding="async" onError={() => setFailed(document.thumbnail)} />
    ) : (
        <Icon size={iconSize} aria-hidden="true" />
    )
}
