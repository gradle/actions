import * as gitHubCache from '@actions/cache'
import * as core from '@actions/core'
import {Cache} from './cache-api'

const SEGMENT_DOWNLOAD_TIMEOUT_VAR = 'SEGMENT_DOWNLOAD_TIMEOUT_MINS'
const SEGMENT_DOWNLOAD_TIMEOUT_DEFAULT = 10 * 60 * 1000 // 10 minutes

export class GitHubActionsCache implements Cache {
    isAvailable(): boolean {
        return gitHubCache.isFeatureAvailable()
    }

    async restore(paths: string[], primaryKey: string, restoreKeys?: string[]): Promise<CacheResult | undefined> {
        // Only override the read timeout if the SEGMENT_DOWNLOAD_TIMEOUT_MINS env var has NOT been set
        const cacheRestoreOptions = process.env[SEGMENT_DOWNLOAD_TIMEOUT_VAR]
            ? {}
            : {segmentTimeoutInMs: SEGMENT_DOWNLOAD_TIMEOUT_DEFAULT}

        const restored = await gitHubCache.restoreCache(paths, primaryKey, restoreKeys, cacheRestoreOptions)
        return restored ? this.cacheResult(restored.key, restored.size) : undefined
    }

    async save(paths: string[], key: string): Promise<CacheResult> {
        try {
            const cacheEntry = await gitHubCache.saveCache(paths, key)
            return this.cacheResult(cacheEntry.key, cacheEntry.size)
        } catch (error) {
            if (error instanceof gitHubCache.ReserveCacheError) {
                // Reserve cache errors are expected if the artifact has been previously cached
                core.info(`Cache entry ${key} already exists: ${error}`)
                return this.cacheResult(key, 0)
            }
            throw error
        }
    }

    private cacheResult(key: string, size?: number): CacheResult {
        return new CacheResult(key, size)
    }
}

class CacheResult {
    key: string
    size?: number
    constructor(key: string, size?: number) {
        this.key = key
        this.size = size
    }
}
