import dedent from 'dedent'
import * as github from '@actions/github'
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

import {BuildResult} from '../../src/build-results'
import {SupportStatus} from '../../src/gradle-support-status'

const mockSupportStatusOf = jest.fn<(gradleVersion: string) => SupportStatus | undefined>()
jest.unstable_mockModule('../../src/gradle-support-status', () => ({
    supportStatusOf: mockSupportStatusOf
}))

const {jobMarker, renderSummaryTable} = await import('../../src/job-summary')

beforeEach(() => {
    mockSupportStatusOf.mockReturnValue('active')
})

const MATRIX_INPUT_ENV = 'INPUT_WORKFLOW-JOB-CONTEXT'

function fakeContext(workflow: string, job: string): typeof github.context {
    return {workflow, job} as unknown as typeof github.context
}

const successfulHelpBuild: BuildResult = {
    rootProjectName: 'root',
    rootProjectDir: '/',
    requestedTasks: 'help',
    gradleVersion: '8.0',
    gradleHomeDir: '/opt/gradle',
    buildFailed: false,
    configCacheHit: false,
    buildScanUri: 'https://scans.gradle.com/s/abc123',
    buildScanFailed: false
}

const failedHelpBuild: BuildResult = {
    ...successfulHelpBuild,
    buildFailed: true
}

const longArgsBuild: BuildResult = {
    ...successfulHelpBuild,
    requestedTasks: 'check publishMyLongNamePluginPublicationToMavenCentral publishMyLongNamePluginPublicationToPluginPortal',
}

const scanPublishDisabledBuild: BuildResult = {
    ...successfulHelpBuild,
    buildScanUri: '',
    buildScanFailed: false,
}

const scanPublishFailedBuild: BuildResult = {
    ...successfulHelpBuild,
    buildScanUri: '',
    buildScanFailed: true,
}

describe('renderSummaryTable', () => {
    describe('renders', () => {
        it('successful build', () => {
            const table = renderSummaryTable([successfulHelpBuild])
            expect(table.trim()).toBe(dedent`
                <table>
                    <tr>
                        <th>Gradle Root Project</th>
                        <th>Requested Tasks</th>
                        <th>Gradle Version</th>
                        <th>Build Outcome</th>
                        <th>Build&nbsp;Scan®</th>
                    </tr>
                    <tr>
                        <td>root</td>
                        <td>help</td>
                        <td align='center'>8.0</td>
                        <td align='center'>:white_check_mark:</td>
                        <td><a href="https://scans.gradle.com/s/abc123" rel="nofollow" target="_blank"><img src="https://img.shields.io/badge/Build%20Scan%C2%AE-06A0CE?logo=Gradle" alt="Build Scan published" /></a></td>
                    </tr>
                </table>
            `);
        })
        it('failed build', () => {
            const table = renderSummaryTable([failedHelpBuild])
            expect(table.trim()).toBe(dedent`
                <table>
                    <tr>
                        <th>Gradle Root Project</th>
                        <th>Requested Tasks</th>
                        <th>Gradle Version</th>
                        <th>Build Outcome</th>
                        <th>Build&nbsp;Scan®</th>
                    </tr>
                    <tr>
                        <td>root</td>
                        <td>help</td>
                        <td align='center'>8.0</td>
                        <td align='center'>:x:</td>
                        <td><a href="https://scans.gradle.com/s/abc123" rel="nofollow" target="_blank"><img src="https://img.shields.io/badge/Build%20Scan%C2%AE-06A0CE?logo=Gradle" alt="Build Scan published" /></a></td>
                    </tr>
                </table>
            `);
        })
        describe('when build scan', () => {
            it('publishing disabled', () => {
                const table = renderSummaryTable([scanPublishDisabledBuild])
                expect(table.trim()).toBe(dedent`
                    <table>
                        <tr>
                            <th>Gradle Root Project</th>
                            <th>Requested Tasks</th>
                            <th>Gradle Version</th>
                            <th>Build Outcome</th>
                            <th>Build&nbsp;Scan®</th>
                        </tr>
                        <tr>
                            <td>root</td>
                            <td>help</td>
                            <td align='center'>8.0</td>
                            <td align='center'>:white_check_mark:</td>
                            <td><a href="https://scans.gradle.com" rel="nofollow" target="_blank"><img src="https://img.shields.io/badge/Not%20published-lightgrey" alt="Build Scan not published" /></a></td>
                        </tr>
                    </table>
                `);
            })
            it('publishing failed', () => {
                const table = renderSummaryTable([scanPublishFailedBuild])
                expect(table.trim()).toBe(dedent`
                    <table>
                        <tr>
                            <th>Gradle Root Project</th>
                            <th>Requested Tasks</th>
                            <th>Gradle Version</th>
                            <th>Build Outcome</th>
                            <th>Build&nbsp;Scan®</th>
                        </tr>
                        <tr>
                            <td>root</td>
                            <td>help</td>
                            <td align='center'>8.0</td>
                            <td align='center'>:white_check_mark:</td>
                            <td><a href="https://docs.gradle.com/develocity/gradle-plugin/#troubleshooting" rel="nofollow" target="_blank"><img src="https://img.shields.io/badge/Publish%20failed-orange" alt="Build Scan publish failed" /></a></td>
                        </tr>
                    </table>
                `);
            })
        })
        it('multiple builds', () => {
            const table = renderSummaryTable([successfulHelpBuild, failedHelpBuild])
            expect(table.trim()).toBe(dedent`
                <table>
                    <tr>
                        <th>Gradle Root Project</th>
                        <th>Requested Tasks</th>
                        <th>Gradle Version</th>
                        <th>Build Outcome</th>
                        <th>Build&nbsp;Scan®</th>
                    </tr>
                    <tr>
                        <td>root</td>
                        <td>help</td>
                        <td align='center'>8.0</td>
                        <td align='center'>:white_check_mark:</td>
                        <td><a href="https://scans.gradle.com/s/abc123" rel="nofollow" target="_blank"><img src="https://img.shields.io/badge/Build%20Scan%C2%AE-06A0CE?logo=Gradle" alt="Build Scan published" /></a></td>
                    </tr>
                    <tr>
                        <td>root</td>
                        <td>help</td>
                        <td align='center'>8.0</td>
                        <td align='center'>:x:</td>
                        <td><a href="https://scans.gradle.com/s/abc123" rel="nofollow" target="_blank"><img src="https://img.shields.io/badge/Build%20Scan%C2%AE-06A0CE?logo=Gradle" alt="Build Scan published" /></a></td>
                    </tr>
                </table>
            `);
        })
        it('truncating long requested tasks', () => {
            const table = renderSummaryTable([longArgsBuild])
            expect(table.trim()).toBe(dedent`
                <table>
                    <tr>
                        <th>Gradle Root Project</th>
                        <th>Requested Tasks</th>
                        <th>Gradle Version</th>
                        <th>Build Outcome</th>
                        <th>Build&nbsp;Scan®</th>
                    </tr>
                    <tr>
                        <td>root</td>
                        <td><div title='check publishMyLongNamePluginPublicationToMavenCentral publishMyLongNamePluginPublicationToPluginPortal'>check publishMyLongNamePluginPublicationToMavenCentral publ…</div></td>
                        <td align='center'>8.0</td>
                        <td align='center'>:white_check_mark:</td>
                        <td><a href="https://scans.gradle.com/s/abc123" rel="nofollow" target="_blank"><img src="https://img.shields.io/badge/Build%20Scan%C2%AE-06A0CE?logo=Gradle" alt="Build Scan published" /></a></td>
                    </tr>
                </table>
            `);
        })
    })
})

describe('Gradle version support status', () => {
    it('marks an outdated version and adds a details section', () => {
        mockSupportStatusOf.mockReturnValue('eol')
        const table = renderSummaryTable([successfulHelpBuild])
        expect(table.trim()).toBe(dedent`
            <table>
                <tr>
                    <th>Gradle Root Project</th>
                    <th>Requested Tasks</th>
                    <th>Gradle Version</th>
                    <th>Build Outcome</th>
                    <th>Build&nbsp;Scan®</th>
                </tr>
                <tr>
                    <td>root</td>
                    <td>help</td>
                    <td align='center'>8.0 <span title="End-of-life: no longer receives bug fixes or security fixes">:warning:</span></td>
                    <td align='center'>:white_check_mark:</td>
                    <td><a href="https://scans.gradle.com/s/abc123" rel="nofollow" target="_blank"><img src="https://img.shields.io/badge/Build%20Scan%C2%AE-06A0CE?logo=Gradle" alt="Build Scan published" /></a></td>
                </tr>
            </table>

            <h4>:warning: This Job uses an outdated Gradle version</h4>
            <details>
                <summary>Gradle release end-of-life policy</summary>
                <p>For major versions, Gradle will backport critical fixes and security fixes to the last minor in the
                previous major version. As such, each major Gradle release causes:</p>
                <ul>
                    <li>The previous major version becomes maintenance only. It will only receive critical bug fixes
                    and security fixes.</li>
                    <li>The major version before the previous one to become end-of-life (EOL), and that release line
                    will not receive any new fixes.</li>
                </ul>
                <a href="https://docs.gradle.org/current/userguide/feature_lifecycle.html#eol_support" target="_blank">Gradle feature lifecycle</a>
            </details>
        `);
    })
    it('marks a maintenance-only version', () => {
        mockSupportStatusOf.mockReturnValue('maintenance')
        const table = renderSummaryTable([successfulHelpBuild])
        expect(table).toContain(
            `<td align='center'>8.0 <span title="Maintenance only: receives critical bug fixes and security fixes only">:information_source:</span></td>`
        )
        expect(table).toContain('This Job uses an outdated Gradle version')
    })
})

describe('jobMarker', () => {
    const original = process.env[MATRIX_INPUT_ENV]

    afterEach(() => {
        if (original === undefined) {
            delete process.env[MATRIX_INPUT_ENV]
        } else {
            process.env[MATRIX_INPUT_ENV] = original
        }
    })

    it('builds a hidden marker from the workflow and job', () => {
        process.env[MATRIX_INPUT_ENV] = 'null'
        const marker = jobMarker(fakeContext('CI', 'build'))
        expect(marker).toBe('<!-- gradle-job-summary: ci-build -->')
    })

    it('includes the job matrix in the marker', () => {
        process.env[MATRIX_INPUT_ENV] = JSON.stringify({os: 'ubuntu', java: '17'})
        const marker = jobMarker(fakeContext('CI', 'build'))
        expect(marker).toBe('<!-- gradle-job-summary: ci-build-ubuntu-17 -->')
    })
})
