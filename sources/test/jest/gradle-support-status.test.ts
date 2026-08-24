import {beforeEach, describe, expect, it, jest} from '@jest/globals'

import {BuildResult} from '../../src/build-results'

// Mock @actions/core
const mockWarning = jest.fn<(message: string, properties?: {title?: string}) => void>()
const mockNotice = jest.fn<(message: string, properties?: {title?: string}) => void>()
const mockExportVariable = jest.fn<(name: string, value: string | number) => void>()
jest.unstable_mockModule('@actions/core', () => ({
    warning: mockWarning,
    notice: mockNotice,
    exportVariable: mockExportVariable
}))

const {determineLatestReleasedMajor, exportLatestReleasedMajor, reportSupportStatus} =
    await import('../../src/gradle-support-status')

function build(gradleVersion: string, versionStatus?: string): BuildResult {
    return {gradleVersion, versionStatus} as BuildResult
}

describe('determineLatestReleasedMajor', () => {
    it('ignores pre-releases and snapshots of an unreleased major', () => {
        const versions = [
            '10.0.0-milestone-1',
            '10.0.0-rc-1',
            '10.0.0-SNAPSHOT',
            '10.0.0-20260101120000+0000',
            '9.6.1',
            '8.14'
        ]

        expect(determineLatestReleasedMajor(versions)).toBe(9)
    })

    it('is unaffected by the ordering of the version list', () => {
        expect(determineLatestReleasedMajor(['1.0', '9.0.0', '4.10.3'])).toBe(9)
    })

    it('is undefined when no final release is present', () => {
        expect(determineLatestReleasedMajor(['9.0.0-rc-1', '10.0.0-SNAPSHOT'])).toBeUndefined()
    })

    it('is undefined for an empty version list', () => {
        expect(determineLatestReleasedMajor([])).toBeUndefined()
    })
})

describe('exportLatestReleasedMajor', () => {
    it('exports the boundary the init script needs to classify the running version', () => {
        exportLatestReleasedMajor()

        expect(mockExportVariable).toHaveBeenCalledWith('GRADLE_ACTIONS_LATEST_GRADLE_MAJOR', expect.any(Number))
    })
})

describe('reportSupportStatus', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('warns about a version recorded as end-of-life', () => {
        reportSupportStatus([build('7.6.4', 'eol')])

        expect(mockNotice).not.toHaveBeenCalled()
        expect(mockWarning).toHaveBeenCalledTimes(1)
        const [message, properties] = mockWarning.mock.calls[0]
        expect(message).toContain('Gradle 7.6.4 has reached end-of-life')
        expect(message).toContain('the 7.x release line')
        expect(properties?.title).toBe('Gradle version at end-of-life')
    })

    it('notices a version recorded as maintenance-only', () => {
        reportSupportStatus([build('8.14', 'maintenance')])

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).toHaveBeenCalledTimes(1)
        const [message, properties] = mockNotice.mock.calls[0]
        expect(message).toContain('Gradle 8.14 is in maintenance-only support')
        expect(properties?.title).toBe('Gradle version in maintenance')
    })

    it('says nothing about a version recorded as active', () => {
        reportSupportStatus([build('9.6.1', 'active')])

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).not.toHaveBeenCalled()
    })

    it('says nothing when the init script recorded no status', () => {
        reportSupportStatus([build('7.6.4')])

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).not.toHaveBeenCalled()
    })

    it('annotates each distinct version once', () => {
        reportSupportStatus([build('7.6.4', 'eol'), build('4.10.3', 'eol'), build('7.6.4', 'eol')])

        expect(mockWarning).toHaveBeenCalledTimes(2)
    })

    it('says nothing when no Gradle build ran', () => {
        reportSupportStatus([])

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).not.toHaveBeenCalled()
    })
})
