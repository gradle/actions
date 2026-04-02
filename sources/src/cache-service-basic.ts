import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as path from 'path'

import {BuildResult} from './build-results'
import {CacheOptions, CacheService} from './cache-service'

const PRIMARY_KEY_STATE = 'BASIC_CACHE_PRIMARY_KEY'
const RESTORED_KEY_STATE = 'BASIC_CACHE_RESTORED_KEY'
const CACHE_KEY_PREFIX = 'setup-java'

const GRADLE_BUILD_FILE_PATTERNS = [
    '**/*.gradle*',
    '**/gradle-wrapper.properties',
    'buildSrc/**/Versions.kt',
    'buildSrc/**/Dependencies.kt',
    'gradle/*.versions.toml',
    '**/versions.properties'
]

export class BasicCacheService implements CacheService {
    async restore(gradleUserHome: string, cacheOptions: CacheOptions): Promise<void> {
        if (cacheOptions.disabled || cacheOptions.writeOnly) {
            return
        }

        const cachePaths = getCachePaths(gradleUserHome)
        const primaryKey = await computeCacheKey()
        core.saveState(PRIMARY_KEY_STATE, primaryKey)

        // No "restoreKeys" is set, to start with a clear cache after dependency update
        // See https://github.com/actions/setup-java/issues/269
        try {
            const matchedKey = await cache.restoreCache(cachePaths, primaryKey)
            if (matchedKey) {
                core.saveState(RESTORED_KEY_STATE, matchedKey)
                core.info(`Gradle User Home restored from cache key: ${matchedKey}`)
            } else {
                core.info('Gradle User Home cache not found. Will start with empty state.')
            }
        } catch (error) {
            core.warning(`Failed to restore Gradle User Home from cache: ${error}`)
        }
    }

    async save(gradleUserHome: string, _buildResults: BuildResult[], cacheOptions: CacheOptions): Promise<string> {
        if (cacheOptions.disabled || cacheOptions.readOnly) {
            const restoredKey = core.getState(RESTORED_KEY_STATE)
            if (restoredKey) {
                return `Gradle User Home was restored from cache key \`${restoredKey}\`. Cache was read-only, so entries were not saved.`
            }
            return 'Gradle User Home cache entry was not restored and was not saved (caching is read-only or disabled).'
        }

        const matchedKey = core.getState(RESTORED_KEY_STATE)

        // Inputs are re-evaluated before the post action, so we want the original key used for restore
        let primaryKey = core.getState(PRIMARY_KEY_STATE)
        if (!primaryKey) {
            // Fallback: compute key if restore was not called (e.g. writeOnly mode)
            primaryKey = await computeCacheKey()
        }

        if (matchedKey === primaryKey) {
            core.info(`Cache hit occurred on the primary key ${primaryKey}, not saving cache.`)
            return `Gradle User Home cache hit with exact key \`${primaryKey}\`. Save was skipped.`
        }

        const cachePaths = getCachePaths(gradleUserHome)

        try {
            await cache.saveCache(cachePaths, primaryKey)
            core.info(`Gradle User Home saved to cache with key: ${primaryKey}`)
            return `Gradle User Home saved to cache with key \`${primaryKey}\`.`
        } catch (error) {
            core.warning(`Failed to save Gradle User Home to cache: ${error}`)
            return `Gradle User Home cache save failed: ${error}`
        }
    }
}

function getCachePaths(gradleUserHome: string): string[] {
    return [path.join(gradleUserHome, 'caches'), path.join(gradleUserHome, 'wrapper')]
}

async function computeCacheKey(): Promise<string> {
    const fileHash = await glob.hashFiles(GRADLE_BUILD_FILE_PATTERNS.join('\n'))
    if (!fileHash) {
        throw new Error(
            `No file in ${process.cwd()} matched to [${GRADLE_BUILD_FILE_PATTERNS}], make sure you have checked out the target repository`
        )
    }
    return `${CACHE_KEY_PREFIX}-${process.env['RUNNER_OS']}-${process.arch}-gradle-${fileHash}`
}
