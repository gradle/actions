import * as fs from 'fs'
import * as path from 'path'
import {pathToFileURL} from 'url'

import {CacheConfig, CacheProvider} from './configuration'
import {BasicCacheService} from './cache-service-basic'
import {BuildResult} from './build-results'
import {CacheOptions, CacheService} from './cache-service'

const NOOP_CACHING_REPORT = `
[Cache was disabled](https://github.com/gradle/actions/blob/main/docs/setup-gradle.md#disabling-caching). Gradle User Home was not restored from or saved to the cache.
`

const ENHANCED_CACHE_MESSAGE = `Enhanced Caching: This build is using the proprietary 'gradle-actions-caching' provider for optimized caching support. See https://github.com/gradle/actions/blob/main/DISTRIBUTION.md for terms of use and opt-out instructions.`

const ENHANCED_CACHE_SUMMARY = `
> [!NOTE]
> ### ⚡️ Enhanced Caching
> This build loads loads the proprietary **gradle-actions-caching** provider for optimized caching support. 
> See [DISTRIBUTION.md](https://github.com/gradle/actions/blob/main/DISTRIBUTION.md) for terms of use and opt-out instructions.
`

const BASIC_CACHE_MESSAGE = `Basic Caching: This build uses the open-source caching provider for reliable, path-based caching of Gradle dependencies. Upgrade available: for faster builds and advanced features, consider switching to the Enhanced Caching provider. See https://github.com/gradle/actions/blob/main/DISTRIBUTION.md for details.`

const BASIC_CACHE_SUMMARY = `
> [!NOTE]
> ### 🛡️ Basic Caching
> This build uses the open-source caching provider for reliable, path-based caching of Gradle dependencies. 
> 
> **Upgrade Available:** For faster builds and advanced features, consider switching to the **Enhanced Caching** provider. 
> See [DISTRIBUTION.md](https://github.com/gradle/actions/blob/main/DISTRIBUTION.md) for details.`

class NoOpCacheService implements CacheService {
    async restore(_gradleUserHome: string, _cacheOptions: CacheOptions): Promise<void> {
        return
    }

    async save(_gradleUserHome: string, _buildResults: BuildResult[], _cacheOptions: CacheOptions): Promise<string> {
        return NOOP_CACHING_REPORT
    }
}

class LicenseWarningCacheService implements CacheService {
    private delegate: CacheService
    private summary: string

    constructor(delegate: CacheService, summary: string) {
        this.delegate = delegate
        this.summary = summary
    }

    async restore(gradleUserHome: string, cacheOptions: CacheOptions): Promise<void> {
        await this.delegate.restore(gradleUserHome, cacheOptions)
    }

    async save(gradleUserHome: string, buildResults: BuildResult[], cacheOptions: CacheOptions): Promise<string> {
        const cachingReport = await this.delegate.save(gradleUserHome, buildResults, cacheOptions)
        return `${cachingReport}\n${this.summary}`
    }
}

export async function getCacheService(cacheConfig: CacheConfig): Promise<CacheService> {
    if (cacheConfig.isCacheDisabled()) {
        logCacheMessage('Cache is disabled: will not restore state from previous builds.')
        return new NoOpCacheService()
    }

    if (cacheConfig.getCacheProvider() === CacheProvider.Basic) {
        logCacheMessage(BASIC_CACHE_MESSAGE)
        return new LicenseWarningCacheService(new BasicCacheService(), BASIC_CACHE_SUMMARY)
    }

    logCacheMessage(ENHANCED_CACHE_MESSAGE)
    const cacheService = await loadVendoredCacheService()
    if (cacheConfig.isCacheLicenseAccepted()) {
        return cacheService
    }

    return new LicenseWarningCacheService(cacheService, ENHANCED_CACHE_SUMMARY)
}

export async function loadVendoredCacheService(): Promise<CacheService> {
    const vendoredLibraryPath = findVendoredLibraryPath()
    const moduleUrl = pathToFileURL(vendoredLibraryPath).href
    return (await import(moduleUrl)) as CacheService
}

function findVendoredLibraryPath(): string {
    const moduleDir = import.meta.dirname
    const absolutePath = path.resolve(moduleDir, '../../../sources/vendor/gradle-actions-caching/index.js')

    if (fs.existsSync(absolutePath)) {
        return absolutePath
    }

    throw new Error(`Unable to locate vendored cache library at ${absolutePath}.`)
}

export function logCacheMessage(message: string): void {
    console.info(message)
}
