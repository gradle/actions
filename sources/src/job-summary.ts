import * as core from '@actions/core'
import * as github from '@actions/github'
import {RequestError} from '@octokit/request-error'

import {BuildResult} from './build-results'
import {SummaryConfig, getActionId, getGithubToken} from './configuration'
import {Deprecation, getDeprecations} from './deprecation-collector'

export async function generateJobSummary(
    buildResults: BuildResult[],
    cachingReport: string,
    config: SummaryConfig
): Promise<void> {
    const summaryTable = renderSummaryTable(buildResults)

    const hasFailure = buildResults.some(result => result.buildFailed)
    if (config.shouldGenerateJobSummary(hasFailure)) {
        core.info('Generating Job Summary')

        core.summary.addRaw(summaryTable)
        core.summary.addRaw(cachingReport)
        await core.summary.write()
    } else {
        core.info('============================')
        core.info(summaryTable)
        core.info('============================')
        core.info(cachingReport)
        core.info('============================')
    }

    if (config.shouldAddPRComment(hasFailure)) {
        await addPRComment(summaryTable)
    }
}

async function addPRComment(jobSummary: string): Promise<void> {
    const context = github.context
    if (context.payload.pull_request == null) {
        core.info('No pull_request trigger: not adding PR comment')
        return
    }

    const pull_request_number = context.payload.pull_request.number
    core.info(`Adding Job Summary as comment to PR #${pull_request_number}.`)

    const prComment = `<h3>Job Summary for Gradle</h3>
<a href="${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}" target="_blank">
<h5>${context.workflow} :: <em>${context.job}</em></h5>
</a>

${jobSummary}`

    const github_token = getGithubToken()
    const octokit = github.getOctokit(github_token)
    try {
        await octokit.rest.issues.createComment({
            ...context.repo,
            issue_number: pull_request_number,
            body: prComment
        })
    } catch (error) {
        if (error instanceof RequestError) {
            core.warning(buildWarningMessage(error))
        } else {
            throw error
        }
    }
}

function buildWarningMessage(error: RequestError): string {
    const mainWarning = `Failed to generate PR comment.\n${String(error)}`
    if (error.message === 'Resource not accessible by integration') {
        return `${mainWarning}
Please ensure that the 'pull-requests: write' permission is available for the workflow job.
Note that this permission is never available for a workflow triggered from a repository fork.
`
    }
    return mainWarning
}

function renderSummaryTable(results: BuildResult[]): string {
    return `${renderDeprecations()}\n${renderBuildResults(results)}`
}

function renderDeprecations(): string {
    const deprecations = getDeprecations()
    if (deprecations.length === 0) {
        return ''
    }
    return `
<h4>Deprecation warnings</h4>
This job uses deprecated functionality from the <code>${getActionId()}</code> action. Follow the links for upgrade details.
<ul>
    ${deprecations.map(deprecation => `<li>${getDeprecationHtml(deprecation)}</li>`).join('')}
</ul>

<h4>Gradle Build Results</h4>`
}

function getDeprecationHtml(deprecation: Deprecation): string {
    return `<a href="${deprecation.getDocumentationLink()}" target="_blank">${deprecation.message}</a>`
}

function renderBuildResults(results: BuildResult[]): string {
    if (results.length === 0) {
        return '<b>No Gradle build results detected.</b>'
    }

    return `
<table>
    <tr>
        <th>Gradle Root Project</th>
        <th>Requested Tasks</th>
        <th>Gradle Version</th>
        <th>Build Outcome</th>
        <th>Build Scan®</th>
    </tr>${results.map(result => renderBuildResultRow(result)).join('')}
</table>
    `
}

function renderBuildResultRow(result: BuildResult): string {
    return `
    <tr>
        <td>${truncateString(result.rootProjectName, 30)}</td>
        <td>${truncateString(result.requestedTasks, 60)}</td>
        <td align='center'>${result.gradleVersion}</td>
        <td align='center'>${renderOutcome(result)}</td>
        <td>${renderBuildScan(result)}</td>
    </tr>`
}

function renderOutcome(result: BuildResult): string {
    return result.buildFailed ? ':x:' : ':white_check_mark:'
}

function renderBuildScan(result: BuildResult): string {
    if (result.buildScanFailed) {
        return renderBuildScanBadge(
            'PUBLISH_FAILED',
            'orange',
            'https://docs.gradle.com/develocity/gradle-plugin/#troubleshooting'
        )
    }
    if (result.buildScanUri) {
        return renderBuildScanBadge('PUBLISHED', '06A0CE', result.buildScanUri)
    }
    return renderBuildScanBadge('NOT_PUBLISHED', 'lightgrey', 'https://scans.gradle.com')
}

function renderBuildScanBadge(outcomeText: string, outcomeColor: string, targetUrl: string): string {
    const badgeUrl = `https://img.shields.io/badge/Build%20Scan%C2%AE-${outcomeText}-${outcomeColor}?logo=Gradle`
    const badgeHtml = `<img src="${badgeUrl}" alt="Build Scan ${outcomeText}" />`
    return `<a href="${targetUrl}" rel="nofollow" target="_blank">${badgeHtml}</a>`
}

function truncateString(str: string, maxLength: number): string {
    if (str.length > maxLength) {
        return `<div title='${str}'>${str.slice(0, maxLength - 1)}…</div>`
    } else {
        return str
    }
}
