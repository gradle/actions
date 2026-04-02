import {describe, expect, it, jest, beforeEach} from '@jest/globals'

// Mock @actions/cache
const mockRestoreCache = jest.fn<(paths: string[], primaryKey: string, restoreKeys?: string[]) => Promise<string | undefined>>()
const mockSaveCache = jest.fn<(paths: string[], key: string) => Promise<number>>()
jest.unstable_mockModule('@actions/cache', () => ({
    restoreCache: mockRestoreCache,
    saveCache: mockSaveCache
}))

// Mock @actions/core
const mockInfo = jest.fn<(message: string) => void>()
const mockWarning = jest.fn<(message: string) => void>()
const mockSaveState = jest.fn<(name: string, value: string) => void>()
const mockGetState = jest.fn<(name: string) => string>()
jest.unstable_mockModule('@actions/core', () => ({
    info: mockInfo,
    warning: mockWarning,
    saveState: mockSaveState,
    getState: mockGetState
}))

// Mock @actions/glob
const mockHashFiles = jest.fn<(pattern: string) => Promise<string>>()
jest.unstable_mockModule('@actions/glob', () => ({
    hashFiles: mockHashFiles
}))

const {BasicCacheService} = await import('../../src/cache-service-basic')

const HASH = 'abc123def456'
const PRIMARY_KEY = `setup-java-Linux-${process.arch}-gradle-${HASH}`

describe('BasicCacheService', () => {
    let service: InstanceType<typeof BasicCacheService>

    beforeEach(() => {
        jest.clearAllMocks()
        service = new BasicCacheService()
        process.env['RUNNER_OS'] = 'Linux'
        mockHashFiles.mockResolvedValue(HASH)
    })

    describe('restore', () => {
        it('restores cache without restoreKeys and saves both keys to state', async () => {
            mockRestoreCache.mockResolvedValue(PRIMARY_KEY)

            await service.restore('/home/.gradle', {
                disabled: false,
                readOnly: false,
                writeOnly: false,
                overwriteExisting: false,
                strictMatch: false,
                cleanup: 'never',
                includes: [],
                excludes: []
            })

            // No restoreKeys parameter — exact match only (setup-java#269)
            expect(mockRestoreCache).toHaveBeenCalledWith(
                ['/home/.gradle/caches', '/home/.gradle/wrapper'],
                PRIMARY_KEY
            )
            expect(mockSaveState).toHaveBeenCalledWith('BASIC_CACHE_PRIMARY_KEY', PRIMARY_KEY)
            expect(mockSaveState).toHaveBeenCalledWith('BASIC_CACHE_RESTORED_KEY', PRIMARY_KEY)
        })

        it('saves primary key to state even on cache miss', async () => {
            mockRestoreCache.mockResolvedValue(undefined)

            await service.restore('/home/.gradle', {
                disabled: false,
                readOnly: false,
                writeOnly: false,
                overwriteExisting: false,
                strictMatch: false,
                cleanup: 'never',
                includes: [],
                excludes: []
            })

            expect(mockSaveState).toHaveBeenCalledWith('BASIC_CACHE_PRIMARY_KEY', PRIMARY_KEY)
            expect(mockSaveState).not.toHaveBeenCalledWith('BASIC_CACHE_RESTORED_KEY', expect.anything())
            expect(mockInfo).toHaveBeenCalledWith(
                expect.stringContaining('did not find')
            )
        })

        it('warns on restore failure instead of throwing', async () => {
            mockRestoreCache.mockRejectedValue(new Error('Network error'))

            await service.restore('/home/.gradle', {
                disabled: false,
                readOnly: false,
                writeOnly: false,
                overwriteExisting: false,
                strictMatch: false,
                cleanup: 'never',
                includes: [],
                excludes: []
            })

            expect(mockWarning).toHaveBeenCalledWith(
                expect.stringContaining('failed to restore')
            )
        })

        it('throws when no build files are found', async () => {
            mockHashFiles.mockResolvedValue('')

            await expect(
                service.restore('/home/.gradle', {
                    disabled: false,
                    readOnly: false,
                    writeOnly: false,
                    overwriteExisting: false,
                    strictMatch: false,
                    cleanup: 'never',
                    includes: [],
                    excludes: []
                })
            ).rejects.toThrow('No file in')
        })
    })

    describe('save', () => {
        it('reports readOnly with restored key when cache was hit', async () => {
            mockGetState.mockReturnValue(PRIMARY_KEY)
            const report = await service.save('/home/.gradle', [], {
                disabled: false,
                readOnly: true,
                writeOnly: false,
                overwriteExisting: false,
                strictMatch: false,
                cleanup: 'never',
                includes: [],
                excludes: []
            })

            expect(mockSaveCache).not.toHaveBeenCalled()
            expect(report).toContain('read-only')
            expect(report).toContain(PRIMARY_KEY)
        })

        it('reports readOnly with no restore when cache was missed', async () => {
            mockGetState.mockReturnValue('')
            const report = await service.save('/home/.gradle', [], {
                disabled: false,
                readOnly: true,
                writeOnly: false,
                overwriteExisting: false,
                strictMatch: false,
                cleanup: 'never',
                includes: [],
                excludes: []
            })

            expect(mockSaveCache).not.toHaveBeenCalled()
            expect(report).toContain('read-only')
            expect(report).toContain('No cache entry')
        })

        it('skips save when restored key equals primary key', async () => {
            mockGetState.mockImplementation((name: string) => {
                if (name === 'BASIC_CACHE_PRIMARY_KEY') return PRIMARY_KEY
                if (name === 'BASIC_CACHE_RESTORED_KEY') return PRIMARY_KEY
                return ''
            })

            const report = await service.save('/home/.gradle', [], {
                disabled: false,
                readOnly: false,
                writeOnly: false,
                overwriteExisting: false,
                strictMatch: false,
                cleanup: 'never',
                includes: [],
                excludes: []
            })

            expect(mockSaveCache).not.toHaveBeenCalled()
            expect(report).toContain('Save was skipped')
        })

        it('saves cache and returns report on success', async () => {
            mockGetState.mockImplementation((name: string) => {
                if (name === 'BASIC_CACHE_PRIMARY_KEY') return PRIMARY_KEY
                return ''
            })
            mockSaveCache.mockResolvedValue(0)

            const report = await service.save('/home/.gradle', [], {
                disabled: false,
                readOnly: false,
                writeOnly: false,
                overwriteExisting: false,
                strictMatch: false,
                cleanup: 'never',
                includes: [],
                excludes: []
            })

            expect(mockSaveCache).toHaveBeenCalledWith(
                ['/home/.gradle/caches', '/home/.gradle/wrapper'],
                PRIMARY_KEY
            )
            expect(report).toContain('saved entry with key')
        })

        it('warns on save failure instead of throwing', async () => {
            mockGetState.mockImplementation((name: string) => {
                if (name === 'BASIC_CACHE_PRIMARY_KEY') return PRIMARY_KEY
                return ''
            })
            mockSaveCache.mockRejectedValue(new Error('Storage full'))

            const report = await service.save('/home/.gradle', [], {
                disabled: false,
                readOnly: false,
                writeOnly: false,
                overwriteExisting: false,
                strictMatch: false,
                cleanup: 'never',
                includes: [],
                excludes: []
            })

            expect(mockWarning).toHaveBeenCalledWith(
                expect.stringContaining('failed to save')
            )
            expect(report).toContain('failed')
        })
    })
})
