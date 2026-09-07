import {describe, expect, it} from '@jest/globals'

import {GradleVersion} from '../../src/gradle-version'
import {parseGradleVersionFromOutput} from '../../src/execution/gradle'

function order(a: string, b: string): number {
    return Math.sign(GradleVersion.compare(new GradleVersion(a), new GradleVersion(b)))
}

/** Asserts every pairing of `versions`, which must be listed oldest first. */
function ascending(versions: string[]): void {
    for (let i = 0; i < versions.length; i++) {
        for (let j = 0; j < versions.length; j++) {
            const expected = Math.sign(i - j)
            it(`${versions[i]} vs ${versions[j]} is ${expected}`, () => {
                expect(order(versions[i], versions[j])).toBe(expected)
            })
        }
    }
}

describe('GradleVersion', () => {
    describe('orders', () => {
        describe('simple versions', () => {
            ascending(['6.0', '6.7', '6.7.1', '6.7.2', '7.0', '7.0.1', '7.1', '8.0', '8.12.1'])
        })

        describe('a shorter base is older than a longer one that extends it', () => {
            ascending(['7.0', '7.0.0'])
            ascending(['7.1', '7.1.0'])
        })

        describe('rc versions', () => {
            ascending(['8.10', '8.11-rc-1', '8.11-rc-2', '8.11', '8.11.1-rc-1', '8.11.1'])
        })

        describe('milestone versions', () => {
            ascending(['8.12.1', '8.12.2-milestone-1', '8.12.2', '8.13-milestone-1', '8.13-milestone-2', '8.13'])
        })

        describe('preview versions', () => {
            ascending(['8.12.1', '8.12.2-preview-1', '8.12.2', '8.13-preview-1', '8.13-preview-2', '8.13'])
        })

        describe('milestone before preview before rc before final', () => {
            ascending(['8.12.2-milestone-1', '8.12.2-preview-1', '8.12.2-rc-1', '8.12.2'])
        })

        describe('snapshot versions', () => {
            ascending(['8.10.1', '8.10.2-20240828012138+0000', '8.10.2', '8.11-20240829002031+0000', '8.11'])
            ascending(['9.0', '9.1-branch-provider_api_migration_public_api_changes-20240826121451+0000', '9.1'])
        })

        describe('snapshots order by instant, accounting for timezone', () => {
            ascending(['8.10.2-milestone-1', '8.10.2-20240828010000+1000', '8.10.2-20240828012138+0000', '8.10.2'])
        })
    })

    // Gradle's `Stage.from` matches the whole stage string against /(\d+)([a-z])?/, so a stage number is
    // read only when the string is entirely a number with an optional letter suffix.
    describe('reads a stage number only from a fully numeric stage string', () => {
        it('orders plain stage numbers numerically, not as text', () => {
            // Were these compared as text, '8.11-rc-10' would sort before '8.11-rc-2'.
            expect(order('8.11-rc-2', '8.11-rc-10')).toBe(-1)
        })

        describe('a letter suffix orders after the bare number', () => {
            ascending(['8.11-rc-1', '8.11-rc-1a', '8.11-rc-1b', '8.11-rc-2'])
        })

        it('ignores digits embedded in a longer stage string', () => {
            // 'issue10' and 'issue9' both rank as stage number 0, leaving the version string to break the
            // tie; reading the digits positionally would instead sort 'issue10' after 'issue9'.
            expect(order('8.0-branch-issue10-20240828012138+0000', '8.0-branch-issue9-20240828012138+0000')).toBe(-1)
        })
    })

    describe('matches stage names exactly, as Gradle does', () => {
        // 'RC' is not 'rc', so it ranks as unknown (1) and precedes preview (2) rather than following it.
        describe('an unrecognised spelling ranks between milestone and preview', () => {
            ascending(['8.0-milestone-1', '8.0-RC-1', '8.0-preview-1', '8.0-rc-1', '8.0'])
        })
    })

    describe('rejects a timestamp that names no real instant', () => {
        it.each(['8.0-99999999999999', '8.0-20241301012138', '8.0-20240828992138', '8.0-20240828012138+9999'])(
            'throws for %s',
            version => {
                expect(() => new GradleVersion(version)).toThrow('is not a valid Gradle snapshot timestamp')
            }
        )

        it.each(['8.0-99999999999999', '8.0-20240828012138+9999'])(
            'reports %s as unparseable rather than yielding an uncomparable version',
            version => {
                expect(GradleVersion.parseUntrusted(version)).toBeUndefined()
            }
        )
    })

    describe('isFinalRelease', () => {
        it.each(['1.0', '8.14.5', '9.7.1'])('treats %s as final', version => {
            expect(new GradleVersion(version).isFinalRelease()).toBe(true)
        })

        it.each(['8.11-rc-1', '8.0-milestone-6', '8.10.2-20240828012138+0000', '9.0-SNAPSHOT'])(
            'treats %s as not final',
            version => {
                expect(new GradleVersion(version).isFinalRelease()).toBe(false)
            }
        )
    })

    describe('parseUntrusted', () => {
        it.each(['', 'unknown', 'v1.0'])('returns undefined for the invalid version %s', version => {
            expect(GradleVersion.parseUntrusted(version)).toBeUndefined()
        })
    })
})

describe('parseGradleVersionFromOutput', () => {
    it('major version', () => {
        const output = `
    ------------------------------------------------------------
    Gradle 8.9
    ------------------------------------------------------------
    `
        expect(parseGradleVersionFromOutput(output)).toBe('8.9')
    })

    it('patch version', () => {
        const output = `
    ------------------------------------------------------------
    Gradle 8.9.1
    ------------------------------------------------------------
    `
        expect(parseGradleVersionFromOutput(output)).toBe('8.9.1')
    })

    it('rc version', () => {
        const output = `
    ------------------------------------------------------------
    Gradle 8.9-rc-1
    ------------------------------------------------------------
    `
        expect(parseGradleVersionFromOutput(output)).toBe('8.9-rc-1')
    })

    it('milestone version', () => {
        const output = `
    ------------------------------------------------------------
    Gradle 8.0-milestone-6
    ------------------------------------------------------------
    `
        expect(parseGradleVersionFromOutput(output)).toBe('8.0-milestone-6')
    })

    it('snapshot version', () => {
        const output = `
    ------------------------------------------------------------
    Gradle 8.10.2-20240828012138+0000
    ------------------------------------------------------------
    `
        expect(parseGradleVersionFromOutput(output)).toBe('8.10.2-20240828012138+0000')
    })

    it('branch version', () => {
        const output = `
    ------------------------------------------------------------
    Gradle 9.0-branch-provider_api_migration_public_api_changes-20240830060514+0000
    ------------------------------------------------------------
    `
        expect(parseGradleVersionFromOutput(output)).toBe(
            '9.0-branch-provider_api_migration_public_api_changes-20240830060514+0000'
        )
    })
})
