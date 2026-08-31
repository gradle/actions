import {beforeEach, describe, expect, it, jest} from '@jest/globals'

const mockWarning = jest.fn<(message: string, properties?: {title?: string}) => void>()
const mockNotice = jest.fn<(message: string, properties?: {title?: string}) => void>()
jest.unstable_mockModule('@actions/core', () => ({
    warning: mockWarning,
    notice: mockNotice
}))

const DOC = 'https://docs.gradle.org/current/userguide/feature_lifecycle.html#eol_support'

const {SupportStatusKind, renderSupportStatusUsing, reportSupportStatusUsing, supportStatusUsing} = await import(
    '../../src/gradle-support-status'
)

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

describe('classification', () => {
    it.each(['7.6.4', '1.0', '4.10.3'])('treats %s as end-of-life', version => {
        expect(supportStatusUsing(version, RELEASED)).toBe(SupportStatusKind.Eol)
    })

    it.each(['8.0', '8.0.2', '8.3', '8.13', '8.14', '8.14.3', '8.14.5'])(
        'treats %s as behind, being on the previous major',
        version => {
            expect(supportStatusUsing(version, RELEASED)).toBe(SupportStatusKind.Behind)
        }
    )

    it.each(['8.15', '8.15.1'])('treats %s as behind, not as something worse', version => {
        // Gradle has shipped a minor of the previous major after the new major: 7.0 (Apr 2021), then 6.9
        // (May 2021) and 6.9.1-6.9.4. Such a version is newer than the release data knows about.
        expect(supportStatusUsing(version, RELEASED)).toBe(SupportStatusKind.Behind)
    })

    it('treats a previous major absent from the release data as behind', () => {
        expect(supportStatusUsing('8.0', ['9.7.1', '7.6.4'])).toBe(SupportStatusKind.Behind)
    })

    it.each(['9.0.0', '9.2.1', '9.4.1'])('treats %s as behind, being more than 2 minors back', version => {
        expect(supportStatusUsing(version, RELEASED)).toBe(SupportStatusKind.Behind)
    })

    it.each(['9.5.0', '9.5.1', '9.6.1', '9.7.1'])('says nothing about %s, inside the grace band', version => {
        expect(supportStatusUsing(version, RELEASED)).toBe(SupportStatusKind.Current)
    })

    it('lets the grace band silence patch drift on the current major', () => {
        expect(supportStatusUsing('9.6.0', RELEASED)).toBe(SupportStatusKind.Current)
        expect(supportStatusUsing('9.7.0', RELEASED)).toBe(SupportStatusKind.Current)
    })

    it.each(['10.0', '10.4.2'])('says nothing about %s, newer than the release data', version => {
        expect(supportStatusUsing(version, RELEASED)).toBe(SupportStatusKind.Current)
    })

    it.each(['9.8.0-rc-1', '7.0-milestone-1', '9.8-20260101120000+0000'])('says nothing about %s', version => {
        expect(supportStatusUsing(version, RELEASED)).toBe(SupportStatusKind.Current)
    })

    it('says nothing when the release data holds no final release', () => {
        expect(supportStatusUsing('1.0', ['9.0.0-rc-1', '10.0.0-SNAPSHOT'])).toBe(SupportStatusKind.Current)
    })

    it('does not throw on an unparseable version', () => {
        expect(supportStatusUsing('', RELEASED)).toBe(SupportStatusKind.Current)
        expect(supportStatusUsing('unknown', RELEASED)).toBe(SupportStatusKind.Current)
    })
})

describe('renderSupportStatus', () => {
    const LEGEND = `<p>:information_source: Consider upgrading — See <a href="${DOC}">Gradle release lifecycle</a></p>`

    it('folds an end-of-life version under a warning sign, linking the security subscription', () => {
        const rendered = renderSupportStatusUsing(['7.6.4'], RELEASED)

        expect(rendered).toContain('<summary>:warning: Gradle 7.6.4 is end-of-life</summary>')
        expect(rendered).toContain(
            'The 7.x release line receives no new fixes of any kind. Update to the latest Gradle version.'
        )
        expect(rendered).toContain('<a href="https://gradle.org/security-subscription/">Gradle Security Subscription</a>')
        expect(rendered).not.toContain(LEGEND)
    })

    it('names no version in the fold beyond the one that is end-of-life', () => {
        expect(renderSupportStatusUsing(['7.6.4'], RELEASED)).not.toContain('9.7.1')
    })

    it.each(['8.0', '8.14.3', '8.14.5', '9.2.1'])('adds only the legend for %s', version => {
        expect(renderSupportStatusUsing([version], RELEASED).trim()).toBe(LEGEND)
    })

    it('adds the legend exactly once however many versions are flagged', () => {
        const rendered = renderSupportStatusUsing(['9.2.1', '9.4.1', '8.14.5', '8.14.3', '8.3', '8.0'], RELEASED)

        expect(rendered.trim()).toBe(LEGEND)
    })

    it('emits one fold per end-of-life version plus the single legend', () => {
        const rendered = renderSupportStatusUsing(['9.6.1', '9.2.1', '8.14.5', '8.0', '7.6.4', '1.0'], RELEASED)

        expect(rendered.match(/<details>/g)).toHaveLength(2)
        expect(rendered.match(/Consider upgrading/g)).toHaveLength(1)
    })

    it('names no version outside the fold', () => {
        const rendered = renderSupportStatusUsing(['8.0', '9.2.1'], RELEASED)

        expect(rendered).not.toContain('8.0')
        expect(rendered).not.toContain('9.2.1')
    })

    it('renders nothing when every version is inside the grace band', () => {
        expect(renderSupportStatusUsing(['9.5.1', '9.6.1', '9.7.1'], RELEASED)).toBe('')
    })

    it('renders nothing when no Gradle build ran', () => {
        expect(renderSupportStatusUsing([], RELEASED)).toBe('')
    })
})

describe('reportSupportStatus', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('warns about an end-of-life version', () => {
        reportSupportStatusUsing(['7.6.4'], RELEASED)

        expect(mockWarning).toHaveBeenCalledTimes(1)
        const [message, properties] = mockWarning.mock.calls[0]
        expect(message).toContain('Gradle 7.6.4 is end-of-life')
        expect(message).toContain('Update to the latest Gradle version.')
        expect(message).toContain('https://gradle.org/security-subscription/')
        expect(properties?.title).toBe('Gradle version at end-of-life')
    })

    it.each(['8.0', '8.14.3', '8.14.5', '9.2.1'])('notices %s as out of date', version => {
        reportSupportStatusUsing([version], RELEASED)

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).toHaveBeenCalledTimes(1)
        const [message, properties] = mockNotice.mock.calls[0]
        expect(message).toBe(
            `Gradle ${version} is out of date: consider updating to the latest Gradle version. See ${DOC}`
        )
        expect(properties?.title).toBe('Gradle version out of date')
    })

    it.each(['9.5.1', '9.6.1', '9.7.1'])('stays quiet about %s, inside the grace band', version => {
        reportSupportStatusUsing([version], RELEASED)

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).not.toHaveBeenCalled()
    })

    it('annotates each distinct version once, at the level its status warrants', () => {
        reportSupportStatusUsing(['7.6.4', '4.10.3', '7.6.4', '8.0', '9.2.1', '8.0'], RELEASED)

        expect(mockWarning).toHaveBeenCalledTimes(2)
        expect(mockNotice).toHaveBeenCalledTimes(2)
    })

    it('says nothing when no Gradle build ran', () => {
        reportSupportStatusUsing([], RELEASED)

        expect(mockWarning).not.toHaveBeenCalled()
        expect(mockNotice).not.toHaveBeenCalled()
    })
})
