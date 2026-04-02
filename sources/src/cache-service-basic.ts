import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as path from 'path'

import {BuildResult} from './build-results'
import {CacheOptions, CacheService} from './cache-service'

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

        // No "restoreKeys" is set, to start with a clear cache after dependency update
        // See https://github.com/actions/setup-java/issues/269
        try {
            const matchedKey = await cache.restoreCache(cachePaths, primaryKey)
            if (matchedKey) {
                core.saveState(RESTORED_KEY_STATE, matchedKey)
                core.info(`Basic caching restored from cache key: ${matchedKey}`)
            } else {
                core.info('Basic caching did not find an entry to restore. Will start with empty state.')
            }
        } catch (error) {
            core.warning(`Basic caching failed to restore from cache: ${error}`)
        }
    }

    async save(gradleUserHome: string, _buildResults: BuildResult[], cacheOptions: CacheOptions): Promise<string> {
        if (cacheOptions.disabled) {
            return 'Basic caching was disabled.'
        }
        if (cacheOptions.readOnly) {
            const restoredKey = core.getState(RESTORED_KEY_STATE)
            if (restoredKey) {
                return `Basic caching was read-only. Restored from cache key \`${restoredKey}\`.`
            }
            return 'Basic caching was read-only. No cache entry was found to restore.'
        }

        const primaryKey = await computeCacheKey()
        const matchedKey = core.getState(RESTORED_KEY_STATE)

        if (matchedKey === primaryKey) {
            core.info(`Basic caching restored entry with key \`${primaryKey}\`. Save was skipped.`)
            return `Basic caching restored entry with key \`${primaryKey}\`. Save was skipped.`
        }

        const cachePaths = getCachePaths(gradleUserHome)

        try {
            await cache.saveCache(cachePaths, primaryKey)
            core.info(`Basic caching saved entry with key: ${primaryKey}`)
            return `Basic caching saved entry with key \`${primaryKey}\`.`
        } catch (error) {
            core.warning(`Basic caching failed to save entry with key \`${primaryKey}\`: ${error}`)
            return `Basic caching save failed: ${error}`
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
