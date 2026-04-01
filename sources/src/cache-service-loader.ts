import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'
import {pathToFileURL} from 'url'

import {CacheConfig} from './configuration'
import {BuildResult} from './build-results'
import {CacheOptions, CacheService} from './cache-service'

const NOOP_CACHING_REPORT = `
[Cache was disabled](https://github.com/gradle/actions/blob/main/docs/setup-gradle.md#disabling-caching). Gradle User Home was not restored from or saved to the cache.
`

const LEGACY_CACHE_LOG_MESSAGE = 'Using the legacy caching module'
const VENDORED_CACHE_LOG_MESSAGE = 'Using the `gradle-actions-caching` caching module'

const LEGACY_CACHE_REPORT_NOTICE = `
> _Using the legacy caching module._
`

const VENDORED_CACHE_REPORT_NOTICE = `
> _Using the 'gradle-actions-caching' caching module._
`

class NoOpCacheService implements CacheService {
    async restore(_gradleUserHome: string, _cacheOptions: CacheOptions): Promise<void> {
        return
    }

    async save(_gradleUserHome: string, _buildResults: BuildResult[], _cacheOptions: CacheOptions): Promise<string> {
        return NOOP_CACHING_REPORT
    }
}

class LoggingCacheService implements CacheService {
    private delegate: CacheService
    private logMessage: string
    private reportNotice: string

    constructor(delegate: CacheService, logMessage: string, reportNotice: string) {
        this.delegate = delegate
        this.logMessage = logMessage
        this.reportNotice = reportNotice
    }

    async restore(gradleUserHome: string, cacheOptions: CacheOptions): Promise<void> {
        core.info(this.logMessage)
        await this.delegate.restore(gradleUserHome, cacheOptions)
    }

    async save(gradleUserHome: string, buildResults: BuildResult[], cacheOptions: CacheOptions): Promise<string> {
        const cachingReport = await this.delegate.save(gradleUserHome, buildResults, cacheOptions)
        return `${cachingReport}\n${this.reportNotice}`
    }
}

export async function getCacheService(cacheConfig: CacheConfig): Promise<CacheService> {
    if (cacheConfig.isCacheDisabled()) {
        return new NoOpCacheService()
    }

    if (cacheConfig.isCacheLicenseAccepted()) {
        const vendoredService = await loadVendoredCacheService()
        return new LoggingCacheService(vendoredService, VENDORED_CACHE_LOG_MESSAGE, VENDORED_CACHE_REPORT_NOTICE)
    }

    const legacyService = await loadLegacyCacheService()
    return new LoggingCacheService(legacyService, LEGACY_CACHE_LOG_MESSAGE, LEGACY_CACHE_REPORT_NOTICE)
}

export async function loadVendoredCacheService(): Promise<CacheService> {
    const vendoredLibraryPath = findLibraryPath('sources/vendor/gradle-actions-caching/index.js')
    const moduleUrl = pathToFileURL(vendoredLibraryPath).href
    return (await import(moduleUrl)) as CacheService
}

export async function loadLegacyCacheService(): Promise<CacheService> {
    const legacyLibraryPath = findLibraryPath('dist/legacy-caching/index.js')
    const moduleUrl = pathToFileURL(legacyLibraryPath).href
    return (await import(moduleUrl)) as CacheService
}

function findLibraryPath(relativePath: string): string {
    const moduleDir = import.meta.dirname
    const absolutePath = path.resolve(moduleDir, '../../..', relativePath)

    if (fs.existsSync(absolutePath)) {
        return absolutePath
    }

    throw new Error(`Unable to locate cache library at ${absolutePath}.`)
}
