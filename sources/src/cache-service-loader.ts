import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'
import {pathToFileURL} from 'url'

import {CacheConfig, CacheProvider} from './configuration'
import {BasicCacheService} from './cache-service-basic'
import {BuildResult} from './build-results'
import {CacheOptions, CacheReport, CacheService} from './cache-service'
import {isActive, ProviderNote} from './caching-report'

const ENHANCED_CACHE_MESSAGE = `Enhanced Caching: This build is using the proprietary 'gradle-actions-caching' provider for optimized caching support. See https://github.com/gradle/actions/blob/main/DISTRIBUTION.md for terms of use and opt-out instructions.`

const BASIC_CACHE_MESSAGE = `Basic Caching: This build uses the basic open-source caching provider. For faster builds and advanced features, consider switching to the Enhanced Caching provider. See https://github.com/gradle/actions/blob/main/DISTRIBUTION.md for details.`

class NoOpCacheService implements CacheService {
    async restore(_gradleUserHome: string, _cacheOptions: CacheOptions): Promise<void> {
        return
    }

    async save(
        _gradleUserHome: string,
        _buildResults: BuildResult[],
        _cacheOptions: CacheOptions
    ): Promise<CacheReport> {
        return {status: 'disabled', entries: []}
    }
}

export async function getCacheService(cacheConfig: CacheConfig): Promise<CacheService> {
    if (cacheConfig.isCacheDisabled()) {
        logCacheMessage('Cache is disabled: will not restore state from previous builds.')
        return new NoOpCacheService()
    }

    if (cacheConfig.getCacheProvider() === CacheProvider.Basic) {
        logCacheMessage(BASIC_CACHE_MESSAGE)
        return new BasicCacheService()
    }

    logCacheMessage(ENHANCED_CACHE_MESSAGE)
    return loadVendoredCacheService()
}

/**
 * Identifies the caching provider for the Job Summary. Returns `undefined` when
 * caching is disabled, since no provider is engaged in that case.
 */
export function getProviderNote(cacheConfig: CacheConfig): ProviderNote | undefined {
    if (cacheConfig.isCacheDisabled()) {
        return undefined
    }
    return cacheConfig.getCacheProvider() === CacheProvider.Basic ? {kind: 'basic'} : {kind: 'enhanced'}
}

/**
 * Reconciles the cache report with any other action in this workflow that has advertised
 * itself as handling dependency caching (via GRADLE_ACTIONS_EXTERNAL_CACHE_PROVIDER).
 *
 * When our own caching is disabled, this re-labels the report so the summary attributes
 * the disabled Gradle User Home cache to that action instead of reporting a bare "caching
 * was disabled" alongside the other action's own caching report.
 *
 * Note this only softens the wording — the report still states that caching is disabled
 * here, so a user who disabled it by mistake is not left in the dark. The one case that
 * wording cannot cover is the opposite mistake: caching left *enabled* while another
 * action caches the same Gradle User Home. That is warned about rather than re-labelled.
 */
export function applyExternalCacheHandler(report: CacheReport, cacheConfig: CacheConfig): CacheReport {
    const handler = cacheConfig.getExternalCacheHandler()
    if (!handler) {
        return report
    }
    const handlerName = handler.label ?? 'Another action'

    if (isActive(report.status)) {
        core.warning(
            `${handlerName} is providing dependency caching in this workflow, but setup-gradle caching is also enabled — ` +
                `both are caching the Gradle User Home. Set 'cache-disabled: true' to leave dependency caching to ${handlerName}.`
        )
        return report
    }

    // 'disabled' is the only status reachable when caching is disabled: getCacheService
    // short-circuits to the no-op service, so the statuses reported by the real cache
    // service ('disabled-existing-home', 'not-available') cannot arise here.
    if (report.status !== 'disabled') {
        return report
    }
    return {...report, status: 'disabled-external', externalCacheHandler: handler.label}
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
