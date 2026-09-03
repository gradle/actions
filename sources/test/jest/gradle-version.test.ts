import {describe, expect, it} from '@jest/globals'

import {GradleVersion} from '../../src/execution/gradle-version'
import {parseGradleVersionFromOutput} from '../../src/execution/gradle'

function order(a: string, b: string): number {
    return Math.sign(GradleVersion.compare(new GradleVersion(a), new GradleVersion(b)))
}

describe('GradleVersion', () => {
    describe('orders', () => {
        // Asserts the list is in strictly ascending order: every pair compares to sign(i - j),
        // which also covers equality (a version compared with itself is 0).
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
            // 8.10.2-20240828010000+1000 is 2024-08-27T15:00:00Z, before 8.10.2-20240828012138+0000.
            // A milestone (a stage) precedes any snapshot of the same base, which precedes the release.
            ascending(['8.10.2-milestone-1', '8.10.2-20240828010000+1000', '8.10.2-20240828012138+0000', '8.10.2'])
        })
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

    describe('parse', () => {
        it.each(['', 'unknown', 'v1.0'])('returns undefined for the invalid version %s', version => {
            expect(GradleVersion.parse(version)).toBeUndefined()
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
