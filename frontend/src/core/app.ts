/**
 * Who the app is, from appconfig/app.config.json, the one file Go and the build read too.
 * `make rename` changes it; nothing else here names the app.
 */

import config from '../../../appconfig/app.config.json'

export const APP = {
    /** Shown in the title bar, the About page and messages. */
    name: config.name,
    /** Names files and storage, and is written into every document file. */
    id: config.id,
    /** Where updates, issues and the changelog live: owner/name on GitHub. */
    repository: config.repository,
    /** Who makes it, for About. */
    company: config.company,
    version: config.version,
} as const

export const REPOSITORY_URL = `https://github.com/${APP.repository}`
