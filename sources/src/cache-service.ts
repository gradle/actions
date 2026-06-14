import {BuildResult} from './build-results'

export interface CacheOptions {
    disabled: boolean
    readOnly: boolean
    writeOnly: boolean
    overwriteExisting: boolean
    strictMatch: boolean
    cleanup: string
    encryptionKey?: string
    develocityAccessToken?: string
    develocityServerUrl?: string
    includes: string[]
    excludes: string[]
}

export type CacheStatus =
    | 'enabled'
    | 'read-only'
    | 'write-only'
    | 'disabled'
    | 'disabled-existing-home'
    | 'not-available'

export type CacheCleanupStatus =
    | 'enabled'
    | 'disabled-param'
    | 'disabled-failure'
    | 'disabled-config-cache-hit'
    | 'disabled-readonly'

export type ProjectCacheStatus =
    | 'not-enabled' // the hidden opt-in env var was not set (rendered as nothing)
    | 'trial-expired' // past the hard trial expiry
    | 'trial-not-licensed' // Develocity trial token missing or invalid
    | 'no-encryption-key' // Cannot store due to missing encryption key
    | 'enabled' // Trial in effect: will attempt to save project state

export interface CacheEntryReport {
    entryName: string
    requestedKey?: string
    restoredKey?: string
    restoredSize?: number
    restoredTime?: number
    restoredOutcome: string
    savedKey?: string
    savedSize?: number
    savedTime?: number
    savedOutcome: string
}

/**
 * Structured result of a cache save operation. Rendering this into a human-readable
 * Job Summary is handled centrally by `caching-report.ts`.
 */
export interface CacheReport {
    status: CacheStatus
    cleanup?: CacheCleanupStatus
    projectCache?: ProjectCacheStatus
    entries: CacheEntryReport[]
}

export interface CacheService {
    restore(gradleUserHome: string, cacheOptions: CacheOptions): Promise<void>
    save(gradleUserHome: string, buildResults: BuildResult[], cacheOptions: CacheOptions): Promise<CacheReport>
}
