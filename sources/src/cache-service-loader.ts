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

const CACHE_LICENSE_WARNING = `
***********************************************************
LICENSING NOTICE

The caching functionality in \`gradle-actions\` has been extracted into \`gradle-actions-caching\`, a proprietary commercial component that is not covered by the MIT License. 
The bundled \`gradle-actions-caching\` component is licensed and governed by a separate license, available at https://gradle.com/legal/terms-of-use/.

The \`gradle-actions-caching\` component is used only when caching is enabled and is not loaded or used when caching is disabled.

Use of the \`gradle-actions-caching\` component is subject to a separate license, available at https://gradle.com/legal/terms-of-use/. 
If you do not agree to these license terms, do not use the \`gradle-actions-caching\` component.

You can suppress this message by accepting the terms in your action configuration: see https://github.com/gradle/actions/blob/main/README.md
***********************************************************
`

const CACHE_LICENSE_SUMMARY = `
> [!IMPORTANT]
> #### Licensing notice
>
> The caching functionality in \`gradle-actions\` has been extracted into \`gradle-actions-caching\`, a proprietary commercial component that is not covered by the MIT License. 
> The bundled \`gradle-actions-caching\` component is licensed and governed by a separate license, available at https://gradle.com/legal/terms-of-use/.
>
> The \`gradle-actions-caching\` component is used only when caching is enabled and is not loaded or used when caching is disabled.
>
> Use of the \`gradle-actions-caching\` component is subject to a separate license, available at https://gradle.com/legal/terms-of-use/. 
> If you do not agree to these license terms, do not use the \`gradle-actions-caching\` component.
>
>You can suppress this message by [accepting the terms in your action configuration](https://github.com/gradle/actions/blob/main/README.md).
`

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

    constructor(delegate: CacheService) {
        this.delegate = delegate
    }

    async restore(gradleUserHome: string, cacheOptions: CacheOptions): Promise<void> {
        await this.delegate.restore(gradleUserHome, cacheOptions)
    }

    async save(gradleUserHome: string, buildResults: BuildResult[], cacheOptions: CacheOptions): Promise<string> {
        const cachingReport = await this.delegate.save(gradleUserHome, buildResults, cacheOptions)
        return `${cachingReport}\n${CACHE_LICENSE_SUMMARY}`
    }
}

export async function getCacheService(cacheConfig: CacheConfig): Promise<CacheService> {
    if (cacheConfig.isCacheDisabled()) {
        return new NoOpCacheService()
    }

    if (cacheConfig.getCacheProvider() === CacheProvider.Basic) {
        return new BasicCacheService()
    }

    const cacheService = await loadVendoredCacheService()
    if (cacheConfig.isCacheLicenseAccepted()) {
        return cacheService
    }

    await logCacheLicenseWarning()
    return new LicenseWarningCacheService(cacheService)
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

export async function logCacheLicenseWarning(): Promise<void> {
    console.info(CACHE_LICENSE_WARNING)
}
