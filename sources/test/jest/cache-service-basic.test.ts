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
        it('skips restore when disabled', async () => {
            await service.restore('/home/.gradle', {
                disabled: true,
                readOnly: false,
                writeOnly: false,
                overwriteExisting: false,
                strictMatch: false,
                cleanup: 'never',
                includes: [],
                excludes: []
            })

            expect(mockRestoreCache).not.toHaveBeenCalled()
        })

        it('skips restore when writeOnly', async () => {
            await service.restore('/home/.gradle', {
                disabled: false,
                readOnly: false,
                writeOnly: true,
                overwriteExisting: false,
                strictMatch: false,
                cleanup: 'never',
                includes: [],
                excludes: []
            })

            expect(mockRestoreCache).not.toHaveBeenCalled()
        })

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

        it('handles cache miss gracefully', async () => {
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

            // Primary key should still be saved to state even on miss
            expect(mockSaveState).toHaveBeenCalledWith('BASIC_CACHE_PRIMARY_KEY', PRIMARY_KEY)
            // Restored key should NOT be saved
            expect(mockSaveState).not.toHaveBeenCalledWith('BASIC_CACHE_RESTORED_KEY', expect.anything())
            expect(mockInfo).toHaveBeenCalledWith(
                expect.stringContaining('not found')
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
                expect.stringContaining('Failed to restore')
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
        it('skips save when disabled', async () => {
            mockGetState.mockReturnValue('')
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

            expect(mockSaveCache).not.toHaveBeenCalled()
            expect(report).toContain('not restored')
        })

        it('skips save when readOnly and reports restored key', async () => {
            mockGetState.mockImplementation((name: string) => {
                if (name === 'BASIC_CACHE_RESTORED_KEY') return PRIMARY_KEY
                return ''
            })
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
            expect(report).toContain('restored from cache key')
            expect(report).toContain(PRIMARY_KEY)
            expect(report).toContain('read-only')
        })

        it('skips save when readOnly and no restore', async () => {
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
            expect(report).toContain('not restored')
        })

        it('skips save when matched key equals primary key', async () => {
            mockGetState.mockImplementation((name: string) => {
                if (name === 'BASIC_CACHE_RESTORED_KEY') return PRIMARY_KEY
                if (name === 'BASIC_CACHE_PRIMARY_KEY') return PRIMARY_KEY
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

        it('uses primary key from state, not recomputed', async () => {
            const stateKey = `setup-java-Linux-${process.arch}-gradle-statedhash`
            mockGetState.mockImplementation((name: string) => {
                if (name === 'BASIC_CACHE_PRIMARY_KEY') return stateKey
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
                stateKey
            )
            expect(report).toContain(stateKey)
        })

        it('computes key as fallback when primary key not in state', async () => {
            mockGetState.mockReturnValue('')
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
            expect(report).toContain('saved to cache')
        })

        it('warns on save failure instead of throwing', async () => {
            mockGetState.mockReturnValue('')
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
                expect.stringContaining('Failed to save')
            )
            expect(report).toContain('failed')
        })
    })
})
