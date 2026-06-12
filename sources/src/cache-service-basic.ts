import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as path from 'path'

import {BuildResult} from './build-results'
import {CacheEntryReport, CacheOptions, CacheReport, CacheService} from './cache-service'

const ENTRY_NAME = 'Gradle User Home'

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
    async restore(gradleUserHome: string, _cacheOptions: CacheOptions): Promise<void> {
        const cachePaths = getCachePaths(gradleUserHome)
        const primaryKey = await computeCacheKey()
        core.saveState(PRIMARY_KEY_STATE, primaryKey)

        // No "restoreKeys" is set, to start with a clear cache after dependency update
        // See https://github.com/actions/setup-java/issues/269
        try {
            const restoredKey = await cache.restoreCache(cachePaths, primaryKey)
            if (restoredKey) {
                core.saveState(RESTORED_KEY_STATE, restoredKey)
                core.info(`Basic caching restored from cache key: ${restoredKey}`)
            } else {
                core.info('Basic caching did not find an entry to restore. Will start with empty state.')
            }
        } catch (error) {
            core.warning(`Basic caching failed to restore from cache: ${error}`)
        }
    }

    async save(gradleUserHome: string, _buildResults: BuildResult[], cacheOptions: CacheOptions): Promise<CacheReport> {
        const primaryKey = core.getState(PRIMARY_KEY_STATE)
        const restoredKey = core.getState(RESTORED_KEY_STATE)

        if (cacheOptions.readOnly) {
            return {
                status: 'read-only',
                entries: [
                    entryReport({
                        primaryKey,
                        restoredKey,
                        restoredOutcome: restoredKey
                            ? '(Entry restored: exact match found)'
                            : '(Entry not restored: no match found)',
                        savedOutcome: '(Entry not saved: cache is read-only)'
                    })
                ]
            }
        }

        if (restoredKey === primaryKey) {
            core.info(`Basic caching restored entry with key \`${primaryKey}\`. Save was skipped.`)
            return {
                status: 'enabled',
                entries: [
                    entryReport({
                        primaryKey,
                        restoredKey,
                        restoredOutcome: '(Entry restored: exact match found)',
                        savedOutcome: '(Entry not saved: entry with key already exists)'
                    })
                ]
            }
        }

        const cachePaths = getCachePaths(gradleUserHome)

        try {
            await cache.saveCache(cachePaths, primaryKey)
            core.info(`Basic caching saved entry with key: ${primaryKey}`)
            return {
                status: 'enabled',
                entries: [
                    entryReport({
                        primaryKey,
                        restoredKey,
                        savedKey: primaryKey,
                        restoredOutcome: restoredKey
                            ? '(Entry restored: exact match found)'
                            : '(Entry not restored: no match found)',
                        savedOutcome: '(Entry saved)'
                    })
                ]
            }
        } catch (error) {
            core.warning(`Basic caching failed to save entry with key \`${primaryKey}\`: ${error}`)
            return {
                status: 'enabled',
                entries: [
                    entryReport({
                        primaryKey,
                        restoredKey,
                        restoredOutcome: restoredKey
                            ? '(Entry restored: exact match found)'
                            : '(Entry not restored: no match found)',
                        savedOutcome: `(Entry not saved: ${error})`
                    })
                ]
            }
        }
    }
}

function entryReport(opts: {
    primaryKey: string
    restoredKey?: string
    savedKey?: string
    restoredOutcome: string
    savedOutcome: string
}): CacheEntryReport {
    return {
        entryName: ENTRY_NAME,
        requestedKey: opts.primaryKey || undefined,
        restoredKey: opts.restoredKey || undefined,
        restoredOutcome: opts.restoredOutcome,
        savedKey: opts.savedKey || undefined,
        savedOutcome: opts.savedOutcome
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
