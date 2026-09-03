import dedent from 'dedent'
import * as github from '@actions/github'
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

import {BuildResult} from '../../src/build-results'

let releasedVersions = [{version: '8.0', checksum: ''}]
jest.unstable_mockModule('../../src/wrapper-validation/wrapper-checksums.json', () => ({
    get default() {
        return releasedVersions
    }
}))

const {jobMarker, renderSummaryTable, renderSupportStatusUsing} = await import('../../src/job-summary')

async function renderWith(versions: string[], results: BuildResult[]): Promise<string> {
    releasedVersions = versions.map(version => ({version, checksum: ''}))
    jest.resetModules()
    const {renderSummaryTable: render} = await import('../../src/job-summary')
    return render(results)
}

const DOC = 'https://docs.gradle.org/current/userguide/feature_lifecycle.html#eol_support'
const SECURITY_SUBSCRIPTION = 'https://gradle.org/security-subscription/?utm_source=github-action'

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
    requestedTasks:
        'check publishMyLongNamePluginPublicationToMavenCentral publishMyLongNamePluginPublicationToPluginPortal'
}

const scanPublishDisabledBuild: BuildResult = {
    ...successfulHelpBuild,
    buildScanUri: '',
    buildScanFailed: false
}

const scanPublishFailedBuild: BuildResult = {
    ...successfulHelpBuild,
    buildScanUri: '',
    buildScanFailed: true
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
            `)
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
            `)
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
                `)
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
                `)
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
            `)
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
            `)
        })
    })
})

describe('Gradle version support status', () => {
    it('warns on an end-of-life version and folds the detail below the table', async () => {
        const table = await renderWith(['10.0.0', '8.0'], [successfulHelpBuild])
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
                    <td align='center'>8.0 :warning:</td>
                    <td align='center'>:white_check_mark:</td>
                    <td><a href="https://scans.gradle.com/s/abc123" rel="nofollow" target="_blank"><img src="https://img.shields.io/badge/Build%20Scan%C2%AE-06A0CE?logo=Gradle" alt="Build Scan published" /></a></td>
                </tr>
            </table>

            <details>
                <summary>:warning: Gradle 8.0 is end-of-life</summary>
                <p>The 8.x release line receives no new fixes of any kind. Update to the latest Gradle version.</p>
                <p>Options for staying secure on an end-of-life version: <a href="${SECURITY_SUBSCRIPTION}">Gradle Security Subscription</a></p>
            </details>
        `)
    })
    it('signs a still-supported but outdated version with the info sign and one legend', async () => {
        const table = await renderWith(['9.0.0', '8.1', '8.0'], [successfulHelpBuild])
        expect(table).toContain(`<td align='center'>8.0 :information_source:</td>`)
        expect(table).toContain(
            `<p>:information_source: Consider upgrading — See <a href="${DOC}">Gradle release lifecycle</a></p>`
        )
        expect(table).not.toContain('<details>')
    })
    it('adds nothing for a version inside the grace band', async () => {
        const table = await renderWith(['8.2', '8.0'], [successfulHelpBuild])
        expect(table).toContain(`<td align='center'>8.0</td>`)
        expect(table).not.toContain(':information_source:')
        expect(table).not.toContain('Consider upgrading')
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
        expect(rendered).toContain(`<a href="${SECURITY_SUBSCRIPTION}">Gradle Security Subscription</a>`)
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
