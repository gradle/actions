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
    | 'enabled' // Gradle User Home was restored from and saved to the cache
    | 'read-only' // restored from the cache, but not saved
    | 'write-only' // saved to the cache, but not restored
    | 'disabled' // caching was turned off via the cache-disabled parameter
    | 'disabled-existing-home' // a pre-existing Gradle User Home was found, so caching was skipped
    | 'not-available' // the GitHub Actions cache service could not be reached
    | 'external' // Gradle User Home is cached by an external provider, not by this action

export type CacheCleanupStatus =
    | 'enabled' // stale files were purged from Gradle User Home before saving
    | 'disabled-param' // disabled via action parameter
    | 'disabled-failure' // skipped due to a build failure
    | 'disabled-config-cache-hit' // skipped due to configuration-cache reuse
    | 'disabled-readonly' // always disabled when the cache is read-only

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
