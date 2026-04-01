import * as core from '@actions/core'

export const ACTION_METADATA_DIR = '.setup-gradle'

/**
 * Represents the cache options passed from the main action.
 * This mirrors the CacheOptions interface from the main package.
 */
export interface CacheOptions {
    disabled: boolean
    readOnly: boolean
    writeOnly: boolean
    overwriteExisting: boolean
    strictMatch: boolean
    cleanup: string
    encryptionKey?: string
    includes: string[]
    excludes: string[]
}

/**
 * Adapts the CacheOptions interface to the old CacheConfig method-based API
 * expected by the recovered caching code.
 */
export class CacheConfig {
    private readonly options: CacheOptions

    constructor(options: CacheOptions) {
        this.options = options
    }

    isCacheDisabled(): boolean {
        return this.options.disabled
    }

    isCacheReadOnly(): boolean {
        return this.options.readOnly
    }

    isCacheWriteOnly(): boolean {
        return this.options.writeOnly
    }

    isCacheOverwriteExisting(): boolean {
        return this.options.overwriteExisting
    }

    isCacheStrictMatch(): boolean {
        return this.options.strictMatch
    }

    isCacheCleanupEnabled(): boolean {
        return this.options.cleanup !== 'never'
    }

    shouldPerformCacheCleanup(hasFailure: boolean): boolean {
        const cleanup = this.options.cleanup
        if (cleanup === 'always') {
            return true
        }
        if (cleanup === 'on-success') {
            return !hasFailure
        }
        return false
    }

    getCacheCleanupOption(): string {
        return this.options.cleanup
    }

    getCacheEncryptionKey(): string | undefined {
        return this.options.encryptionKey
    }

    getCacheIncludes(): string[] {
        return [...this.options.includes]
    }

    getCacheExcludes(): string[] {
        return [...this.options.excludes]
    }
}

export function getJobMatrix(): string {
    return core.getInput('workflow-job-context')
}
