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

    it.each(['8.0', '8.0.2', '8.3', '8.13'])('treats %s as unmaintained', version => {
        expect(supportStatusUsing(version, RELEASED)).toBe(SupportStatusKind.Unmaintained)
    })

    it.each(['8.14', '8.14.3'])('treats %s as unpatched', version => {
        expect(supportStatusUsing(version, RELEASED)).toBe(SupportStatusKind.Unpatched)
    })

    it('treats the latest patch of the maintained line as maintenance', () => {
        expect(supportStatusUsing('8.14.5', RELEASED)).toBe(SupportStatusKind.Maintenance)
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
    it('folds an end-of-life version, linking the security subscription', () => {
        const rendered = renderSupportStatusUsing(['7.6.4'], RELEASED)

        expect(rendered).toContain('<summary>:octagonal_sign: Gradle 7.6.4 is end-of-life</summary>')
        expect(rendered).toContain(
            'The 7.x release line receives no new fixes of any kind. Update to at least Gradle <strong>9.7.1</strong>.'
        )
        expect(rendered).toContain('Gradle security subscription</a>')
    })

    it('reports a single unmaintained version', () => {
        expect(renderSupportStatusUsing(['8.0'], RELEASED)).toContain(
            `:warning: <strong>8.0</strong> <a href="${DOC}">Unmaintained</a> — update Gradle to at least <strong>9.7.1</strong>, or at least <strong>8.14.5</strong>`
        )
    })

    it('reports a single unpatched version', () => {
        expect(renderSupportStatusUsing(['8.14.3'], RELEASED)).toContain(
            `:warning: <strong>8.14.3</strong> <a href="${DOC}">Unpatched</a> — update Gradle to at least <strong>9.7.1</strong>, or at least <strong>8.14.5</strong>`
        )
    })

    it('reports the maintained line with its own wording', () => {
        expect(renderSupportStatusUsing(['8.14.5'], RELEASED)).toContain(
            `:information_source: <strong>8.14.5</strong> <a href="${DOC}">Maintenance only</a> — Update Gradle to at least <strong>9.7.1</strong>`
        )
    })

    it('reports a single version behind the latest', () => {
        expect(renderSupportStatusUsing(['9.2.1'], RELEASED)).toContain(
            `:information_source: <strong>9.2.1</strong> <a href="${DOC}">Out of date</a> — update Gradle to at least <strong>9.7.1</strong>`
        )
    })

    it('groups both warn kinds into one entry labelled Unmaintained', () => {
        const rendered = renderSupportStatusUsing(['8.14.3', '8.0'], RELEASED)

        expect(rendered).toContain(
            `:warning: <strong>8.0, 8.14.3</strong> <a href="${DOC}">Unmaintained</a> — update Gradle to at least <strong>9.7.1</strong>, or at least <strong>8.14.5</strong>`
        )
        expect(rendered).not.toContain('Unpatched')
    })

    it('groups both info kinds into one entry, dropping the maintenance wording', () => {
        const rendered = renderSupportStatusUsing(['9.2.1', '8.14.5'], RELEASED)

        expect(rendered).toContain(
            `:information_source: <strong>8.14.5, 9.2.1</strong> <a href="${DOC}">Out of date</a> — update Gradle to at least <strong>9.7.1</strong>`
        )
        expect(rendered).not.toContain('Maintenance only')
    })

    it('emits one fold and two entries for a job spanning every status', () => {
        const rendered = renderSupportStatusUsing(['9.6.1', '9.2.1', '8.14.5', '8.14.3', '8.0', '7.6.4'], RELEASED)

        expect(rendered.match(/<details>/g)).toHaveLength(1)
        expect(rendered.match(/<p>:warning:/g)).toHaveLength(1)
        expect(rendered.match(/<p>:information_source:/g)).toHaveLength(1)
        expect(rendered).not.toContain('9.6.1')
    })

    it('lists each distinct version once', () => {
        expect(renderSupportStatusUsing(['8.0', '8.0', '8.3'], RELEASED)).toContain('<strong>8.0, 8.3</strong>')
    })

    it('renders nothing when every version is current', () => {
        expect(renderSupportStatusUsing(['9.6.1', '9.7.1'], RELEASED)).toBe('')
    })

    it('renders nothing when no Gradle build ran', () => {
        expect(renderSupportStatusUsing([], RELEASED)).toBe('')
    })

    it('does not end a legend entry with a period', () => {
        for (const entry of renderSupportStatusUsing(['8.0', '9.2.1'], RELEASED).split('\n')) {
            if (entry.startsWith('<p>')) {
                expect(entry).not.toMatch(/\.<\/p>$/)
            }
        }
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
        expect(message).toContain('Update to at least Gradle 9.7.1')
        expect(properties?.title).toBe('Gradle version at end-of-life')
    })

    it.each(['8.0', '8.14.3'])('warns about %s, which is missing fixes', version => {
        reportSupportStatusUsing([version], RELEASED)

        expect(mockWarning).toHaveBeenCalledTimes(1)
        expect(mockWarning.mock.calls[0][1]?.title).toBe('Gradle version missing fixes')
    })

    it.each(['8.14.5', '9.2.1', '9.6.1'])('stays quiet about %s', version => {
        reportSupportStatusUsing([version], RELEASED)

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
    })
})
