import {describe, expect, it, jest, beforeEach} from '@jest/globals'

import {CacheProvider} from '../../src/configuration'
import type {CacheConfig} from '../../src/configuration'

describe('getCacheService selection logic', () => {
    beforeEach(() => {
        jest.restoreAllMocks()
    })

    it('returns NoOpCacheService when cache is disabled', async () => {
        const {getCacheService} = await import('../../src/cache-service-loader')
        const mockConfig = {
            isCacheDisabled: () => true,
            getCacheProvider: () => CacheProvider.Premium,
            isCacheLicenseAccepted: () => true
        } as unknown as CacheConfig

        const service = await getCacheService(mockConfig)
        const report = await service.save('/home/.gradle', [], {
            disabled: true,
            readOnly: false,
            writeOnly: false,
            overwriteExisting: false,
            strictMatch: false,
            cleanup: 'never',
            includes: [],
            excludes: []
        })

        // NoOpCacheService returns a specific report mentioning cache was disabled
        expect(report).toContain('Cache was disabled')
    })

    it('wraps BasicCacheService with LicenseWarningCacheService when cache-provider is basic', async () => {
        const {getCacheService} = await import('../../src/cache-service-loader')
        const mockConfig = {
            isCacheDisabled: () => false,
            getCacheProvider: () => CacheProvider.Basic,
            isCacheLicenseAccepted: () => false
        } as unknown as CacheConfig

        const service = await getCacheService(mockConfig)

        // The service should not be a bare BasicCacheService — it should be wrapped
        // with LicenseWarningCacheService that appends the basic caching summary
        const {BasicCacheService} = await import('../../src/cache-service-basic')
        expect(service).not.toBeInstanceOf(BasicCacheService)
    })
})
