import {beforeEach, describe, expect, it, jest} from '@jest/globals'

// Mock @actions/core
const mockWarning = jest.fn<(message: string, properties?: {title?: string}) => void>()
const mockNotice = jest.fn<(message: string, properties?: {title?: string}) => void>()
jest.unstable_mockModule('@actions/core', () => ({
    warning: mockWarning,
    notice: mockNotice
}))

const {determineLatestReleasedMajor, getSupportStatus, reportSupportStatus} =
    await import('../../src/gradle-support-status')
const {GradleVersion} = await import('../../src/execution/gradle-version')
import wrapperChecksums from '../../src/wrapper-validation/wrapper-checksums.json'

const latestReleasedMajor = determineLatestReleasedMajor(wrapperChecksums.map(entry => entry.version))
const MAINTENANCE_VERSION = `${(latestReleasedMajor ?? 0) - 1}.0`

const DOC = 'https://docs.gradle.org/current/userguide/feature_lifecycle.html#eol_support'

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

describe('getSupportStatus', () => {
    it.each(['10.0.0', '10.4.2', '11.0.0-milestone-1', '12.0.0'])('treats %s as active', version => {
        expect(getSupportStatus(new GradleVersion(version), 10)).toBe('active')
    })

    it.each(['9.0.0', '9.6.1', '9.7.0-rc-2'])('treats %s as maintenance-only', version => {
        expect(getSupportStatus(new GradleVersion(version), 10)).toBe('maintenance')
    })

    it.each(['8.14', '8.0.2', '7.6.4', '4.10.3', '1.0'])('treats %s as end-of-life', version => {
        expect(getSupportStatus(new GradleVersion(version), 10)).toBe('eol')
    })
})

describe('reportSupportStatus', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('warns about an end-of-life version', () => {
        reportSupportStatus(['7.6.4'])

        expect(mockNotice).not.toHaveBeenCalled()
        expect(mockWarning).toHaveBeenCalledTimes(1)
        const [message, properties] = mockWarning.mock.calls[0]
        expect(message).toContain('Gradle 7.6.4 has reached end-of-life')
        expect(message).toContain('the 7.x release line no longer receives bug fixes or security fixes')
        expect(message).toContain(DOC)
        expect(properties?.title).toBe('Gradle version at end-of-life')
    })

    it('notices a maintenance-only version', () => {
        reportSupportStatus([MAINTENANCE_VERSION])

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).toHaveBeenCalledTimes(1)
        const [message, properties] = mockNotice.mock.calls[0]
        expect(message).toContain(`Gradle ${MAINTENANCE_VERSION} is in maintenance-only support`)
        expect(message).toContain('receives critical bug fixes and security fixes only')
        expect(properties?.title).toBe('Gradle version in maintenance')
    })

    it('says nothing about a version in the latest release line', () => {
        reportSupportStatus(['999.0.0'])

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).not.toHaveBeenCalled()
    })

    it('annotates each distinct version once', () => {
        reportSupportStatus(['7.6.4', '4.10.3', '7.6.4'])

        expect(mockWarning).toHaveBeenCalledTimes(2)
    })

    it('says nothing when no Gradle build ran', () => {
        reportSupportStatus([])

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).not.toHaveBeenCalled()
    })
})
