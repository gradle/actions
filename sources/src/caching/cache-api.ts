import {GitHubActionsCache} from './github-actions-cache'

export function getCache(): Cache {
    return new GitHubActionsCache()
}

export interface Cache {
    /**
     * @returns boolean return true if cache service feature is available, otherwise false
     */
    isAvailable(): boolean

    /**
     * Restores cache from keys
     *
     * @param paths a list of file paths to restore from the cache
     * @param primaryKey an explicit key for restoring the cache. Lookup is done with prefix matching.
     * @param restoreKeys an optional ordered list of keys to use for restoring the cache if no cache hit occurred for primaryKey
     * @returns the restored entry details for the cache hit, otherwise returns undefined
     */
    restore(paths: string[], primaryKey: string, restoreKeys?: string[]): Promise<CacheResult | undefined>

    /**
     * Saves a list of files with the specified key
     *
     * @param paths a list of file paths to be cached
     * @param key an explicit key for restoring the cache
     * @returns the saved entry details if the cache was saved successfully and throws an error if save fails
     */
    save(paths: string[], key: string): Promise<CacheResult>
}

export declare class CacheResult {
    key: string
    size?: number
    constructor(key: string, size?: number)
}
