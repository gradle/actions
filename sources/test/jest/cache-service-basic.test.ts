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
const mockGlob = jest.fn<() => Promise<string[]>>()
jest.unstable_mockModule('@actions/glob', () => ({
    create: jest.fn<() => Promise<{glob: typeof mockGlob}>>().mockImplementation(async () => ({
        glob: mockGlob
    }))
}))

// Mock fs
const mockReadFileSync = jest.fn()
const mockStatSync = jest.fn()
jest.unstable_mockModule('fs', () => ({
    readFileSync: mockReadFileSync,
    statSync: mockStatSync,
    default: {readFileSync: mockReadFileSync, statSync: mockStatSync}
}))

const {BasicCacheService} = await import('../../src/cache-service-basic')

const KEY_PREFIX = `gradle-actions-basic-Linux-${process.arch}-gradle-`

describe('BasicCacheService', () => {
    let service: InstanceType<typeof BasicCacheService>

    beforeEach(() => {
        jest.clearAllMocks()
        service = new BasicCacheService()
        process.env['RUNNER_OS'] = 'Linux'
        mockGlob.mockResolvedValue([])
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

        it('restores cache and saves state on hit', async () => {
            mockRestoreCache.mockResolvedValue(`${KEY_PREFIX}abc123`)

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

            expect(mockRestoreCache).toHaveBeenCalledWith(
                ['/home/.gradle/caches', '/home/.gradle/wrapper'],
                expect.stringContaining(KEY_PREFIX),
                [KEY_PREFIX]
            )
            expect(mockSaveState).toHaveBeenCalledWith(
                'BASIC_CACHE_RESTORED_KEY',
                `${KEY_PREFIX}abc123`
            )
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

            expect(mockSaveState).not.toHaveBeenCalled()
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
            mockGetState.mockReturnValue(`${KEY_PREFIX}abc123`)
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
            expect(report).toContain(`${KEY_PREFIX}abc123`)
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

        it('saves cache and returns report on success', async () => {
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
                expect.stringContaining(KEY_PREFIX)
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
