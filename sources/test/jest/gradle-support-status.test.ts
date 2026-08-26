import {beforeEach, describe, expect, it, jest} from '@jest/globals'

// Mock @actions/core
const mockWarning = jest.fn<(message: string, properties?: {title?: string}) => void>()
const mockNotice = jest.fn<(message: string, properties?: {title?: string}) => void>()
jest.unstable_mockModule('@actions/core', () => ({
    warning: mockWarning,
    notice: mockNotice
}))

const {SupportStatusKind, reportSupportStatusUsing, supportStatusUsing} = await import(
    '../../src/gradle-support-status'
)

const RELEASED = ['10.4.2', '10.1.0', '10.0.0', '9.6.1', '9.0.0', '8.14', '1.0']

const DOC = 'https://docs.gradle.org/current/userguide/feature_lifecycle.html#eol_support'

describe('supportStatusOf', () => {
    it.each(['10.0.0', '10.4.2', '11.0.0-milestone-1'])('treats %s as active', version => {
        expect(supportStatusUsing(version, RELEASED)).toEqual({kind: SupportStatusKind.Active})
    })

    it.each(['9.0.0', '9.6.1', '9.7.0-rc-2'])('treats %s as maintenance-only', version => {
        expect(supportStatusUsing(version, RELEASED)).toEqual({kind: SupportStatusKind.Maintenance})
    })

    it.each(['8.14', '8.0.2', '7.6.4', '4.10.3', '1.0'])('treats %s as end-of-life', version => {
        expect(supportStatusUsing(version, RELEASED)).toEqual({kind: SupportStatusKind.Eol})
    })

    it('reports a newer patch in the latest release line instead of active', () => {
        expect(supportStatusUsing('10.0.0', ['10.1.0', '10.0.1', '10.0.0'])).toEqual({
            kind: SupportStatusKind.PatchAvailable,
            newerPatch: '10.0.1'
        })
    })

    it('reports the newest patch when several are available', () => {
        expect(supportStatusUsing('8.14', ['8.14.5', '8.14.2', '8.14'])).toEqual({
            kind: SupportStatusKind.PatchAvailable,
            newerPatch: '8.14.5'
        })
    })

    it('ignores a newer minor in the same major', () => {
        expect(supportStatusUsing('9.3.0', ['9.4.0', '9.3.0'])).toEqual({kind: SupportStatusKind.Active})
    })

    it('ignores a newer patch when the release line is already outdated', () => {
        const released = ['10.0.0', '9.0.1', '9.0.0', '8.0.1', '8.0']

        expect(supportStatusUsing('9.0.0', released)).toEqual({kind: SupportStatusKind.Maintenance})
        expect(supportStatusUsing('8.0', released)).toEqual({kind: SupportStatusKind.Eol})
    })

    it('reports no patch update for a pre-release', () => {
        expect(supportStatusUsing('9.3.0-rc-1', ['9.3.1', '9.3.0'])).toEqual({kind: SupportStatusKind.Active})
    })

    it('treats every version as active when the release data holds no final release', () => {
        expect(supportStatusUsing('1.0', ['9.0.0-rc-1', '10.0.0-SNAPSHOT'])).toEqual({kind: SupportStatusKind.Active})
    })
})

describe('reportSupportStatus', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('warns about an end-of-life version', () => {
        reportSupportStatusUsing(['7.6.4'], RELEASED)

        expect(mockNotice).not.toHaveBeenCalled()
        expect(mockWarning).toHaveBeenCalledTimes(1)
        const [message, properties] = mockWarning.mock.calls[0]
        expect(message).toContain('Gradle 7.6.4 has reached end-of-life')
        expect(message).toContain('the 7.x release line no longer receives bug fixes or security fixes')
        expect(message).toContain('Gradle 10.x is the current release line')
        expect(message).toContain(DOC)
        expect(properties?.title).toBe('Gradle version at end-of-life')
    })

    it('notices a maintenance-only version', () => {
        reportSupportStatusUsing(['9.0.0'], RELEASED)

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).toHaveBeenCalledTimes(1)
        const [message, properties] = mockNotice.mock.calls[0]
        expect(message).toContain('Gradle 9.0.0 is in maintenance-only support')
        expect(message).toContain('receives critical bug fixes and security fixes only')
        expect(message).toContain('reaches end-of-life when Gradle 11 is released')
        expect(properties?.title).toBe('Gradle version in maintenance')
    })

    it('notices a version with a newer patch available', () => {
        reportSupportStatusUsing(['10.0.0'], ['10.0.1', '10.0.0'])

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).toHaveBeenCalledTimes(1)
        const [message, properties] = mockNotice.mock.calls[0]
        expect(message).toContain('Gradle 10.0.0 is not the latest patch release')
        expect(message).toContain('Gradle 10.0.1 is available')
        expect(properties?.title).toBe('Gradle patch update available')
    })

    it('says nothing about a version in the latest release line', () => {
        reportSupportStatusUsing(['10.4.2'], RELEASED)

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).not.toHaveBeenCalled()
    })

    it('annotates each distinct version once', () => {
        reportSupportStatusUsing(['7.6.4', '4.10.3', '7.6.4'], RELEASED)

        expect(mockWarning).toHaveBeenCalledTimes(2)
    })

    it('says nothing when no Gradle build ran', () => {
        reportSupportStatusUsing([], RELEASED)

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).not.toHaveBeenCalled()
    })
})
