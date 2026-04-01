import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as glob from '@actions/glob'

import path from 'path'
import fs from 'fs'
import {generateCacheKey} from './cache-key'
import {CacheListener} from './cache-reporting'
import {saveCache, restoreCache, cacheDebug, isCacheDebuggingEnabled, tryDelete} from './cache-utils'
import {CacheConfig, ACTION_METADATA_DIR} from './cache-config-adapter'
import {GradleHomeEntryExtractor} from './gradle-home-extry-extractor'

const RESTORED_CACHE_KEY_KEY = 'restored-cache-key'

export class GradleUserHomeCache {
    private readonly cacheName = 'home'
    private readonly cacheDescription = 'Gradle User Home'

    private readonly userHome: string
    private readonly gradleUserHome: string
    private readonly cacheConfig: CacheConfig

    constructor(userHome: string, gradleUserHome: string, cacheConfig: CacheConfig) {
        this.userHome = userHome
        this.gradleUserHome = gradleUserHome
        this.cacheConfig = cacheConfig
    }

    init(): void {
        this.initializeGradleUserHome()

        // Export the GRADLE_ENCRYPTION_KEY variable if provided
        const encryptionKey = this.cacheConfig.getCacheEncryptionKey()
        if (encryptionKey) {
            core.exportVariable('GRADLE_ENCRYPTION_KEY', encryptionKey)
        }
    }

    cacheOutputExists(): boolean {
        const cachesDir = path.resolve(this.gradleUserHome, 'caches')
        if (fs.existsSync(cachesDir)) {
            cacheDebug(`Cache output exists at ${cachesDir}`)
            return true
        }
        return false
    }

    /**
     * Restores the cache entry, finding the closest match to the currently running job.
     */
    async restore(listener: CacheListener): Promise<void> {
        const entryListener = listener.entry(this.cacheDescription)

        const cacheKey = generateCacheKey(this.cacheName, this.cacheConfig)

        cacheDebug(
            `Requesting ${this.cacheDescription} with
    key:${cacheKey.key}
    restoreKeys:[${cacheKey.restoreKeys}]`
        )

        const cachePath = this.getCachePath()
        const cacheResult = await restoreCache(cachePath, cacheKey.key, cacheKey.restoreKeys, entryListener)
        if (!cacheResult) {
            core.info(`${this.cacheDescription} cache not found. Will initialize empty.`)
            return
        }

        core.saveState(RESTORED_CACHE_KEY_KEY, cacheResult.key)

        try {
            await this.afterRestore(listener)
        } catch (error) {
            core.warning(`Restore ${this.cacheDescription} failed in 'afterRestore': ${error}`)
        }
    }

    /**
     * Restore any extracted cache entries after the main Gradle User Home entry is restored.
     */
    async afterRestore(listener: CacheListener): Promise<void> {
        await this.debugReportGradleUserHomeSize('as restored from cache')
        await new GradleHomeEntryExtractor(this.gradleUserHome, this.cacheConfig).restore(listener)
        await this.deleteExcludedPaths()
        await this.debugReportGradleUserHomeSize('after restoring common artifacts')
    }

    /**
     * Saves the cache entry based on the current cache key unless the cache was restored with the exact key,
     * in which case we cannot overwrite it.
     *
     * If the cache entry was restored with a partial match on a restore key, then
     * it is saved with the exact key.
     */
    async save(listener: CacheListener): Promise<void> {
        const cacheKey = generateCacheKey(this.cacheName, this.cacheConfig).key
        const restoredCacheKey = core.getState(RESTORED_CACHE_KEY_KEY)
        const gradleHomeEntryListener = listener.entry(this.cacheDescription)

        if (restoredCacheKey && cacheKey === restoredCacheKey) {
            core.info(`Cache hit occurred on the cache key ${cacheKey}, not saving cache.`)

            for (const entryListener of listener.cacheEntries) {
                if (entryListener === gradleHomeEntryListener) {
                    entryListener.markNotSaved('cache key not changed')
                } else {
                    entryListener.markNotSaved(`referencing '${this.cacheDescription}' cache entry not saved`)
                }
            }
            return
        }

        try {
            await this.beforeSave(listener)
        } catch (error) {
            core.warning(`Save ${this.cacheDescription} failed in 'beforeSave': ${error}`)
            return
        }

        const cachePath = this.getCachePath()
        await saveCache(cachePath, cacheKey, gradleHomeEntryListener)
        return
    }

    /**
     * Extract and save any defined extracted cache entries prior to the main Gradle User Home entry being saved.
     */
    async beforeSave(listener: CacheListener): Promise<void> {
        await this.debugReportGradleUserHomeSize('before saving common artifacts')
        await this.deleteExcludedPaths()
        await new GradleHomeEntryExtractor(this.gradleUserHome, this.cacheConfig).extract(listener)
        await this.debugReportGradleUserHomeSize(
            "after extracting common artifacts (only 'caches' and 'notifications' will be stored)"
        )
    }

    /**
     * Delete any file paths that are excluded by the `gradle-home-cache-excludes` parameter.
     */
    private async deleteExcludedPaths(): Promise<void> {
        const rawPaths: string[] = this.cacheConfig.getCacheExcludes()
        rawPaths.push('caches/*/cc-keystore')
        const resolvedPaths = rawPaths.map(x => path.resolve(this.gradleUserHome, x))

        for (const p of resolvedPaths) {
            cacheDebug(`Removing excluded path: ${p}`)
            const globber = await glob.create(p, {
                implicitDescendants: false
            })

            for (const toDelete of await globber.glob()) {
                cacheDebug(`Removing excluded file: ${toDelete}`)
                await tryDelete(toDelete)
            }
        }
    }

    /**
     * Determines the paths within Gradle User Home to cache.
     * By default, this is the 'caches' and 'notifications' directories,
     * but this can be overridden by the `gradle-home-cache-includes` parameter.
     */
    protected getCachePath(): string[] {
        const rawPaths: string[] = this.cacheConfig.getCacheIncludes()
        rawPaths.push(ACTION_METADATA_DIR)
        const resolvedPaths = rawPaths.map(x => this.resolveCachePath(x))
        cacheDebug(`Using cache paths: ${resolvedPaths}`)
        return resolvedPaths
    }

    private resolveCachePath(rawPath: string): string {
        if (rawPath.startsWith('!')) {
            const resolved = this.resolveCachePath(rawPath.substring(1))
            return `!${resolved}`
        }
        return path.resolve(this.gradleUserHome, rawPath)
    }

    /**
     * Initialize the Gradle User Home directory for caching.
     * Note: init scripts, toolchain registration, and debug log level are handled by
     * initializeGradleUserHome() in the main package before cacheService.restore() is called.
     */
    private initializeGradleUserHome(): void {
        // Create a directory for storing action metadata
        const actionCacheDir = path.resolve(this.gradleUserHome, ACTION_METADATA_DIR)
        fs.mkdirSync(actionCacheDir, {recursive: true})
    }

    /**
     * When cache debugging is enabled (or ACTIONS_STEP_DEBUG is on),
     * this method will give a detailed report of the Gradle User Home contents.
     */
    private async debugReportGradleUserHomeSize(label: string): Promise<void> {
        if (!isCacheDebuggingEnabled() && !core.isDebug()) {
            return
        }
        if (!fs.existsSync(this.gradleUserHome)) {
            return
        }
        const result = await exec.getExecOutput('du', ['-h', '-c', '-t', '5M'], {
            cwd: this.gradleUserHome,
            silent: true,
            ignoreReturnCode: true
        })

        core.info(`Gradle User Home (directories >5M): ${label}`)

        core.info(
            result.stdout
                .trimEnd()
                .replace(/\t/g, '    ')
                .split('\n')
                .map(it => {
                    return `  ${it}`
                })
                .join('\n')
        )

        core.info('-----------------------')
    }
}
