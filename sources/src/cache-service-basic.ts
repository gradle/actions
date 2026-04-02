import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

import {BuildResult} from './build-results'
import {CacheOptions, CacheService} from './cache-service'

const RESTORED_KEY_STATE = 'BASIC_CACHE_RESTORED_KEY'
const CACHE_KEY_PREFIX = 'gradle-actions-basic'

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
        const restoreKeys = [getRestoreKeyPrefix()]

        try {
            const restoredKey = await cache.restoreCache(cachePaths, primaryKey, restoreKeys)
            if (restoredKey) {
                core.saveState(RESTORED_KEY_STATE, restoredKey)
                core.info(`Gradle User Home restored from cache key: ${restoredKey}`)
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

        const primaryKey = await computeCacheKey()
        const restoredKey = core.getState(RESTORED_KEY_STATE)

        if (restoredKey === primaryKey) {
            core.info(`Gradle User Home cache hit with exact key ${primaryKey}. Save skipped.`)
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

function getRestoreKeyPrefix(): string {
    return `${CACHE_KEY_PREFIX}-${process.env['RUNNER_OS'] || 'unknown'}-${process.arch}-gradle-`
}

async function computeCacheKey(): Promise<string> {
    const fileHash = await hashGradleBuildFiles()
    return `${getRestoreKeyPrefix()}${fileHash}`
}

async function hashGradleBuildFiles(): Promise<string> {
    const hash = crypto.createHash('sha256')
    const globber = await glob.create(GRADLE_BUILD_FILE_PATTERNS.join('\n'))
    const files = (await globber.glob()).sort()

    for (const file of files) {
        const stat = fs.statSync(file)
        if (stat.isFile()) {
            const content = fs.readFileSync(file)
            hash.update(content)
        }
    }

    return hash.digest('hex').substring(0, 32)
}
