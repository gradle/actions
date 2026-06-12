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
            getCacheProvider: () => CacheProvider.Enhanced
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

        // NoOpCacheService reports a disabled cache with no entries
        expect(report.status).toBe('disabled')
        expect(report.entries).toHaveLength(0)
    })

    it('returns a BasicCacheService when cache-provider is basic', async () => {
        const {getCacheService} = await import('../../src/cache-service-loader')
        const mockConfig = {
            isCacheDisabled: () => false,
            getCacheProvider: () => CacheProvider.Basic
        } as unknown as CacheConfig

        const service = await getCacheService(mockConfig)

        const {BasicCacheService} = await import('../../src/cache-service-basic')
        expect(service).toBeInstanceOf(BasicCacheService)
    })

    describe('getProviderNote', () => {
        it('returns undefined when cache is disabled', async () => {
            const {getProviderNote} = await import('../../src/cache-service-loader')
            const mockConfig = {
                isCacheDisabled: () => true,
                getCacheProvider: () => CacheProvider.Enhanced
            } as unknown as CacheConfig

            expect(getProviderNote(mockConfig)).toBeUndefined()
        })

        it('returns basic note for the basic provider', async () => {
            const {getProviderNote} = await import('../../src/cache-service-loader')
            const mockConfig = {
                isCacheDisabled: () => false,
                getCacheProvider: () => CacheProvider.Basic
            } as unknown as CacheConfig

            expect(getProviderNote(mockConfig)).toEqual({kind: 'basic'})
        })

        it('returns enhanced note for the enhanced provider', async () => {
            const {getProviderNote} = await import('../../src/cache-service-loader')
            const mockConfig = {
                isCacheDisabled: () => false,
                getCacheProvider: () => CacheProvider.Enhanced
            } as unknown as CacheConfig

            expect(getProviderNote(mockConfig)).toEqual({kind: 'enhanced'})
        })
    })
})
