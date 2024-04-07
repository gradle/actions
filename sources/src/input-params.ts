import * as core from '@actions/core'
import * as github from '@actions/github'
import * as cache from '@actions/cache'
import {SUMMARY_ENV_VAR} from '@actions/core/lib/summary'

import {parseArgsStringToArgv} from 'string-argv'

export class DependencyGraphConfig {
    dependencyGraphOption = this.getDependencyGraphOption()
    continueOnFailure = this.getDependencyGraphContinueOnFailure()
    artifactRetentionDays = this.getArtifactRetentionDays()

    private getDependencyGraphOption(): DependencyGraphOption {
        const val = core.getInput('dependency-graph')
        switch (val.toLowerCase().trim()) {
            case 'disabled':
                return DependencyGraphOption.Disabled
            case 'generate':
                return DependencyGraphOption.Generate
            case 'generate-and-submit':
                return DependencyGraphOption.GenerateAndSubmit
            case 'generate-and-upload':
                return DependencyGraphOption.GenerateAndUpload
            case 'download-and-submit':
                return DependencyGraphOption.DownloadAndSubmit
            case 'clear':
                return DependencyGraphOption.Clear
        }
        throw TypeError(
            `The value '${val}' is not valid for 'dependency-graph'. Valid values are: [disabled, generate, generate-and-submit, generate-and-upload, download-and-submit, clear]. The default value is 'disabled'.`
        )
    }

    private getDependencyGraphContinueOnFailure(): boolean {
        return getBooleanInput('dependency-graph-continue-on-failure', true)
    }

    private getArtifactRetentionDays(): number {
        const val = core.getInput('artifact-retention-days')
        return parseNumericInput('artifact-retention-days', val, 0)
        // Zero indicates that the default repository settings should be used
    }

    getJobCorrelator(): string {
        return DependencyGraphConfig.constructJobCorrelator(github.context.workflow, github.context.job, getJobMatrix())
    }

    static constructJobCorrelator(workflow: string, jobId: string, matrixJson: string): string {
        const matrixString = this.describeMatrix(matrixJson)
        const label = matrixString ? `${workflow}-${jobId}-${matrixString}` : `${workflow}-${jobId}`
        return this.sanitize(label)
    }

    private static describeMatrix(matrixJson: string): string {
        core.debug(`Got matrix json: ${matrixJson}`)
        const matrix = JSON.parse(matrixJson)
        if (matrix) {
            return Object.values(matrix).join('-')
        }
        return ''
    }

    private static sanitize(value: string): string {
        return value
            .replace(/[^a-zA-Z0-9_-\s]/g, '')
            .replace(/\s+/g, '_')
            .toLowerCase()
    }
}

export enum DependencyGraphOption {
    Disabled = 'disabled',
    Generate = 'generate',
    GenerateAndSubmit = 'generate-and-submit',
    GenerateAndUpload = 'generate-and-upload',
    DownloadAndSubmit = 'download-and-submit',
    Clear = 'clear'
}

export class CacheConfig {
    isCacheDisabled(): boolean {
        if (!cache.isFeatureAvailable()) {
            return true
        }

        return getBooleanInput('cache-disabled')
    }

    isCacheReadOnly(): boolean {
        return !this.isCacheWriteOnly() && getBooleanInput('cache-read-only')
    }

    isCacheWriteOnly(): boolean {
        return getBooleanInput('cache-write-only')
    }

    isCacheOverwriteExisting(): boolean {
        return getBooleanInput('cache-overwrite-existing')
    }

    isCacheStrictMatch(): boolean {
        return getBooleanInput('gradle-home-cache-strict-match')
    }

    isCacheCleanupEnabled(): boolean {
        return getBooleanInput('gradle-home-cache-cleanup') && !this.isCacheReadOnly()
    }

    getCacheEncryptionKey(): string {
        return core.getInput('cache-encryption-key')
    }

    getCacheIncludes(): string[] {
        return core.getMultilineInput('gradle-home-cache-includes')
    }

    getCacheExcludes(): string[] {
        return core.getMultilineInput('gradle-home-cache-excludes')
    }
}

export class SummaryConfig {
    shouldGenerateJobSummary(hasFailure: boolean): boolean {
        // Check if Job Summary is supported on this platform
        if (!process.env[SUMMARY_ENV_VAR]) {
            return false
        }

        // Check if Job Summary is disabled using the deprecated input
        if (!this.isJobSummaryEnabled()) {
            return false
        }

        return this.shouldAddJobSummary(this.getJobSummaryOption(), hasFailure)
    }

    shouldAddPRComment(hasFailure: boolean): boolean {
        return this.shouldAddJobSummary(this.getPRCommentOption(), hasFailure)
    }

    private shouldAddJobSummary(option: JobSummaryOption, hasFailure: boolean): boolean {
        switch (option) {
            case JobSummaryOption.Always:
                return true
            case JobSummaryOption.Never:
                return false
            case JobSummaryOption.OnFailure:
                return hasFailure
        }
    }

    private isJobSummaryEnabled(): boolean {
        return getBooleanInput('generate-job-summary', true)
    }

    private getJobSummaryOption(): JobSummaryOption {
        return this.parseJobSummaryOption('add-job-summary')
    }

    private getPRCommentOption(): JobSummaryOption {
        return this.parseJobSummaryOption('add-job-summary-as-pr-comment')
    }

    private parseJobSummaryOption(paramName: string): JobSummaryOption {
        const val = core.getInput(paramName)
        switch (val.toLowerCase().trim()) {
            case 'never':
                return JobSummaryOption.Never
            case 'always':
                return JobSummaryOption.Always
            case 'on-failure':
                return JobSummaryOption.OnFailure
        }
        throw TypeError(
            `The value '${val}' is not valid for ${paramName}. Valid values are: [never, always, on-failure].`
        )
    }
}

export enum JobSummaryOption {
    Never = 'never',
    Always = 'always',
    OnFailure = 'on-failure'
}

export class BuildScanConfig {
    getBuildScanPublishEnabled(): boolean {
        return getBooleanInput('build-scan-publish') && this.verifyTermsOfUseAgreement()
    }

    getBuildScanTermsOfUseUrl(): string {
        return this.getTermsOfUseProp('build-scan-terms-of-use-url', 'build-scan-terms-of-service-url')
    }

    getBuildScanTermsOfUseAgree(): string {
        return this.getTermsOfUseProp('build-scan-terms-of-use-agree', 'build-scan-terms-of-service-agree')
    }

    private verifyTermsOfUseAgreement(): boolean {
        if (
            (this.getBuildScanTermsOfUseUrl() !== 'https://gradle.com/terms-of-service' &&
                this.getBuildScanTermsOfUseUrl() !== 'https://gradle.com/help/legal-terms-of-use') ||
            this.getBuildScanTermsOfUseAgree() !== 'yes'
        ) {
            core.warning(
                `Terms of use at 'https://gradle.com/help/legal-terms-of-use' must be agreed in order to publish build scans.`
            )
            return false
        }
        return true
    }

    /**
     * TODO @bigdaz: remove support for the deprecated input property in the next major release of the action
     */
    private getTermsOfUseProp(newPropName: string, oldPropName: string): string {
        const newProp = core.getInput(newPropName)
        if (newProp !== '') {
            return newProp
        }
        return core.getInput(oldPropName)
    }
}

export function getGradleVersion(): string {
    return core.getInput('gradle-version')
}

export function getBuildRootDirectory(): string {
    return core.getInput('build-root-directory')
}

export function getArguments(): string[] {
    const input = core.getInput('arguments')
    return parseArgsStringToArgv(input)
}

// Internal parameters
export function getJobMatrix(): string {
    return core.getInput('workflow-job-context')
}

export function getGithubToken(): string {
    return core.getInput('github-token', {required: true})
}

export function parseNumericInput(paramName: string, paramValue: string, paramDefault: number): number {
    if (paramValue.length === 0) {
        return paramDefault
    }
    const numericValue = parseInt(paramValue)
    if (isNaN(numericValue)) {
        throw TypeError(`The value '${paramValue}' is not a valid numeric value for '${paramName}'.`)
    }
    return numericValue
}

function getBooleanInput(paramName: string, paramDefault = false): boolean {
    const paramValue = core.getInput(paramName)
    switch (paramValue.toLowerCase().trim()) {
        case '':
            return paramDefault
        case 'false':
            return false
        case 'true':
            return true
    }
    throw TypeError(`The value '${paramValue} is not valid for '${paramName}. Valid values are: [true, false]`)
}
