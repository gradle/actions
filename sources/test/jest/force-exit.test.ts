import {afterEach, describe, expect, it, jest} from '@jest/globals'

import {forceExit, getForcedExitDelayMs} from '../../src/force-exit'

describe('forceExit', () => {
    afterEach(() => {
        jest.restoreAllMocks()
        jest.useRealTimers()
    })

    it('adds a short delay on Windows before exiting', async () => {
        jest.useFakeTimers()

        const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never)

        const exitPromise = forceExit('win32')
        await jest.advanceTimersByTimeAsync(49)

        expect(exitSpy).not.toHaveBeenCalled()

        await jest.advanceTimersByTimeAsync(1)
        await expect(exitPromise).resolves.toBeUndefined()

        expect(exitSpy).toHaveBeenCalledTimes(1)
    })

    it('exits immediately on non-Windows platforms', async () => {
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never)

        await expect(forceExit('linux')).resolves.toBeUndefined()
        expect(exitSpy).toHaveBeenCalledTimes(1)
    })

    it('only delays on Windows', () => {
        expect(getForcedExitDelayMs('win32')).toBe(50)
        expect(getForcedExitDelayMs('linux')).toBe(0)
        expect(getForcedExitDelayMs('darwin')).toBe(0)
    })
})
