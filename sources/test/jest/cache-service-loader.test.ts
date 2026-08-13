import {describe, expect, it, jest, beforeEach} from '@jest/globals'

import {CacheProvider} from '../../src/configuration'
import type {CacheConfig} from '../../src/configuration'

/**
 * Captures the workflow commands core.* writes to stdout. ESM namespaces are frozen, so
 * @actions/core cannot be spied on directly, and mocking the module would break the
 * node_modules packages that also import it.
 */
function captureWorkflowCommands(): string[] {
    const written: string[] = []
    jest.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown): boolean => {
        written.push(String(chunk))
        return true
    }) as never)
    return written
}

describe('getCacheService selection logic', () => {
    beforeEach(() => {
        jest.restoreAllMocks()
        jest.clearAllMocks()
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

    describe('applyExternalCacheHandler', () => {
        const disabledReport = {status: 'disabled' as const, entries: []}
        const configWith = (handler: {label?: string} | undefined): CacheConfig =>
            ({getExternalCacheHandler: () => handler}) as unknown as CacheConfig

        it('re-labels a disabled report when an external handler is advertised', async () => {
            const {applyExternalCacheHandler} = await import('../../src/cache-service-loader')

            const result = applyExternalCacheHandler(disabledReport, configWith({label: 'Develocity Artifact Cache'}))

            expect(result.status).toBe('disabled-external')
            expect(result.externalCacheHandler).toBe('Develocity Artifact Cache')
        })

        it('re-labels a disabled report when the handler supplied no usable label', async () => {
            const {applyExternalCacheHandler} = await import('../../src/cache-service-loader')

            const result = applyExternalCacheHandler(disabledReport, configWith({}))

            expect(result.status).toBe('disabled-external')
            expect(result.externalCacheHandler).toBeUndefined()
        })

        it('leaves a disabled report unchanged when no external handler is advertised', async () => {
            const {applyExternalCacheHandler} = await import('../../src/cache-service-loader')

            expect(applyExternalCacheHandler(disabledReport, configWith(undefined))).toBe(disabledReport)
        })

        it.each(['enabled', 'read-only', 'write-only'] as const)(
            'warns rather than re-labelling when the cache is %s',
            async status => {
                const {applyExternalCacheHandler} = await import('../../src/cache-service-loader')
                const activeReport = {status, entries: []}
                const written = captureWorkflowCommands()

                const result = applyExternalCacheHandler(activeReport, configWith({label: 'Develocity Artifact Cache'}))

                expect(result).toBe(activeReport)
                const warning = written.find(line => line.startsWith('::warning::'))
                expect(warning).toContain('Develocity Artifact Cache is providing dependency caching')
                expect(warning).toContain("'cache-disabled: true'")
            }
        )

        it('names an unnamed handler generically in the warning', async () => {
            const {applyExternalCacheHandler} = await import('../../src/cache-service-loader')
            const written = captureWorkflowCommands()

            applyExternalCacheHandler({status: 'enabled', entries: []}, configWith({}))

            expect(written.find(line => line.startsWith('::warning::'))).toContain('Another action is providing')
        })

        it('does not warn when the cache is disabled', async () => {
            const {applyExternalCacheHandler} = await import('../../src/cache-service-loader')
            const written = captureWorkflowCommands()

            applyExternalCacheHandler(disabledReport, configWith({label: 'Develocity Artifact Cache'}))

            expect(written.find(line => line.startsWith('::warning::'))).toBeUndefined()
        })
    })
})
