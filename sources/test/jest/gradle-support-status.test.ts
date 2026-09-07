import * as fs from 'fs'
import * as path from 'path'
import {beforeEach, describe, expect, it, jest} from '@jest/globals'

const mockWarning = jest.fn<(message: string, properties?: {title?: string}) => void>()
const mockNotice = jest.fn<(message: string, properties?: {title?: string}) => void>()
jest.unstable_mockModule('@actions/core', () => ({
    warning: mockWarning,
    notice: mockNotice
}))

// Mirrors the real release shape: latest 9.7.1, last 8.x minor is 8.14 with patches up to 8.14.5.
const RELEASED = [
    '9.7.1',
    '9.7.0',
    '9.6.1',
    '9.6.0',
    '9.5.1',
    '9.5.0',
    '9.4.1',
    '9.4.0',
    '9.2.1',
    '9.2.0',
    '9.0.0',
    '8.14.5',
    '8.14',
    '8.13',
    '8.3',
    '8.0.2',
    '8.0',
    '7.6.4',
    '1.0'
]

const asChecksumEntries = (versions: string[]): {version: string; checksum: string}[] =>
    versions.map(version => ({version, checksum: ''}))

let releasedVersions = asChecksumEntries(RELEASED)
jest.unstable_mockModule('../../src/wrapper-validation/wrapper-checksums.json', () => ({
    get default() {
        return releasedVersions
    }
}))

const {renderSupportStatus, reportSupportStatus, supportStatusSign} = await import('../../src/gradle-support-status')

/** Re-imports the module so that its release index is built from `released` instead of RELEASED. */
async function withReleaseData(released: string[]): Promise<typeof import('../../src/gradle-support-status')> {
    releasedVersions = asChecksumEntries(released)
    jest.resetModules()
    try {
        return await import('../../src/gradle-support-status')
    } finally {
        releasedVersions = asChecksumEntries(RELEASED)
    }
}

const NO_SIGN = ''
const OUT_OF_DATE = ':information_source:'
const END_OF_LIFE = ':warning:'

const DOC = 'https://docs.gradle.org/current/userguide/feature_lifecycle.html#eol_support'
const SECURITY_SUBSCRIPTION = 'https://gradle.org/security-subscription/?utm_source=github-action'

describe('supportStatusSign', () => {
    it.each(['7.6.4', '1.0', '4.10.3'])('marks %s as end-of-life', version => {
        expect(supportStatusSign(version)).toBe(END_OF_LIFE)
    })

    it.each(['8.0', '8.0.2', '8.3', '8.13', '8.14', '8.14.3', '8.14.5'])(
        'marks %s as out of date, being on the previous major',
        version => {
            expect(supportStatusSign(version)).toBe(OUT_OF_DATE)
        }
    )

    it.each(['8.15', '8.15.1'])(
        'marks %s, a previous-major minor newer than the release data, as out of date',
        version => {
            expect(supportStatusSign(version)).toBe(OUT_OF_DATE)
        }
    )

    it('marks a previous major absent from the release data as out of date', async () => {
        const {supportStatusSign: sign} = await withReleaseData(['9.7.1', '7.6.4'])

        expect(sign('8.0')).toBe(OUT_OF_DATE)
    })

    it.each(['9.0.0', '9.2.1', '9.4.1'])('marks %s as out of date, being more than 2 minors back', version => {
        expect(supportStatusSign(version)).toBe(OUT_OF_DATE)
    })

    it.each(['9.5.0', '9.5.1', '9.6.1', '9.7.1'])('leaves %s unmarked, inside the grace band', version => {
        expect(supportStatusSign(version)).toBe(NO_SIGN)
    })

    it('lets the grace band silence patch drift on the current major', () => {
        expect(supportStatusSign('9.6.0')).toBe(NO_SIGN)
        expect(supportStatusSign('9.7.0')).toBe(NO_SIGN)
    })

    it.each(['10.0', '10.4.2'])('leaves %s unmarked, newer than the release data', version => {
        expect(supportStatusSign(version)).toBe(NO_SIGN)
    })

    it.each(['9.8.0-rc-1', '7.0-milestone-1', '9.8-20260101120000+0000'])(
        'leaves non-final version %s unmarked',
        version => {
            expect(supportStatusSign(version)).toBe(NO_SIGN)
        }
    )

    it('does not throw on an unparseable version', () => {
        expect(supportStatusSign('')).toBe(NO_SIGN)
        expect(supportStatusSign('unknown')).toBe(NO_SIGN)
    })
})

describe('bundled release data', () => {
    it('contains a final release, so the release index builds instead of failing', async () => {
        const bundled: {version: string}[] = JSON.parse(
            fs.readFileSync(path.resolve('src/wrapper-validation/wrapper-checksums.json'), 'utf-8')
        )

        const {supportStatusSign: sign} = await withReleaseData(bundled.map(entry => entry.version))

        expect(sign('1.0')).toBe(END_OF_LIFE)
    })
})

describe('reportSupportStatus', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('warns about an end-of-life version', () => {
        reportSupportStatus(['7.6.4'])

        expect(mockWarning).toHaveBeenCalledTimes(1)
        expect(mockNotice).not.toHaveBeenCalled()
        const [message, properties] = mockWarning.mock.calls[0]
        expect(message).toBe(
            `Gradle 7.6.4 is end-of-life. The 7.x release line receives no further fixes, security fixes included. Update to the latest Gradle version. If you cannot upgrade, see ${SECURITY_SUBSCRIPTION} for options`
        )
        expect(properties?.title).toBe('End-of-life Gradle version')
    })

    it.each(['8.0', '8.14.3', '8.14.5', '9.2.1'])('notices %s as out of date', version => {
        reportSupportStatus([version])

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).toHaveBeenCalledTimes(1)
        const [message, properties] = mockNotice.mock.calls[0]
        expect(message).toBe(
            `Gradle ${version} is out of date: consider updating to the latest Gradle version. See ${DOC}`
        )
        expect(properties?.title).toBe('Out-of-date Gradle version')
    })

    it.each(['9.5.1', '9.6.1', '9.7.1'])('stays quiet about %s, inside the grace band', version => {
        reportSupportStatus([version])

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).not.toHaveBeenCalled()
    })

    it('annotates each distinct version once, at the level its status warrants', () => {
        reportSupportStatus(['7.6.4', '4.10.3', '7.6.4', '8.0', '9.2.1', '8.0'])

        expect(mockWarning).toHaveBeenCalledTimes(2)
        expect(mockNotice).toHaveBeenCalledTimes(2)
    })

    it('says nothing when no Gradle build ran', () => {
        reportSupportStatus([])

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).not.toHaveBeenCalled()
    })
})

describe('renderSupportStatus', () => {
    const LEGEND = `<p>${OUT_OF_DATE} Consider upgrading — See <a href="${DOC}">Gradle release lifecycle</a></p>`

    it('folds an end-of-life version under a warning sign, linking the security subscription', () => {
        const rendered = renderSupportStatus(['7.6.4'])

        expect(rendered).toContain(`<summary>${END_OF_LIFE} Gradle 7.6.4 is end-of-life</summary>`)
        expect(rendered).toContain(
            'The 7.x release line receives no further fixes, security fixes included. Update to the latest Gradle version.'
        )
        expect(rendered).toContain(`<a href="${SECURITY_SUBSCRIPTION}">Gradle Security Subscription</a>`)
        expect(rendered).not.toContain(LEGEND)
    })

    it('names no version in the fold beyond the one that is end-of-life', () => {
        expect(renderSupportStatus(['7.6.4'])).not.toContain('9.7.1')
    })

    it.each(['8.0', '8.14.3', '8.14.5', '9.2.1'])('adds only the legend for %s', version => {
        expect(renderSupportStatus([version]).trim()).toBe(LEGEND)
    })

    it('adds the legend exactly once however many versions are flagged', () => {
        const rendered = renderSupportStatus(['9.2.1', '9.4.1', '8.14.5', '8.14.3', '8.3', '8.0'])

        expect(rendered.trim()).toBe(LEGEND)
    })

    it('emits one fold per end-of-life version plus the single legend', () => {
        const rendered = renderSupportStatus(['9.6.1', '9.2.1', '8.14.5', '8.0', '7.6.4', '1.0'])

        expect(rendered.match(/<details>/g)).toHaveLength(2)
        expect(rendered.match(/Consider upgrading/g)).toHaveLength(1)
    })

    it('names no version outside the fold', () => {
        const rendered = renderSupportStatus(['8.0', '9.2.1'])

        expect(rendered).not.toContain('8.0')
        expect(rendered).not.toContain('9.2.1')
    })

    it('renders nothing when every version is inside the grace band', () => {
        expect(renderSupportStatus(['9.5.1', '9.6.1', '9.7.1'])).toBe('')
    })

    it('renders nothing when no Gradle build ran', () => {
        expect(renderSupportStatus([])).toBe('')
    })
})
