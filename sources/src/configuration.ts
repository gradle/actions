import * as core from '@actions/core'
import * as github from '@actions/github'
import * as cache from '@actions/cache'
import * as deprecator from './deprecation-collector'
import {SUMMARY_ENV_VAR} from '@actions/core/lib/summary'

import {parseArgsStringToArgv} from 'string-argv'
import path from 'path'

const ACTION_ID_VAR = 'GRADLE_ACTION_ID'

export class DependencyGraphConfig {
    getDependencyGraphOption(): DependencyGraphOption {
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

    getDependencyGraphContinueOnFailure(): boolean {
        return getBooleanInput('dependency-graph-continue-on-failure', true)
    }

    getArtifactRetentionDays(): number {
        const val = core.getInput('artifact-retention-days')
        return parseNumericInput('artifact-retention-days', val, 0)
        // Zero indicates that the default repository settings should be used
    }

    getJobCorrelator(): string {
        return DependencyGraphConfig.constructJobCorrelator(github.context.workflow, github.context.job, getJobMatrix())
    }

    getReportDirectory(): string {
        return path.resolve(getWorkspaceDirectory(), 'dependency-graph-reports')
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
    static DevelocityAccessKeyEnvVar = 'DEVELOCITY_ACCESS_KEY'
    static GradleEnterpriseAccessKeyEnvVar = 'GRADLE_ENTERPRISE_ACCESS_KEY'

    getBuildScanPublishEnabled(): boolean {
        return getBooleanInput('build-scan-publish') && this.verifyTermsOfUseAgreement()
    }

    getBuildScanTermsOfUseUrl(): string {
        return this.getTermsOfUseProp('build-scan-terms-of-use-url', 'build-scan-terms-of-service-url')
    }

    getBuildScanTermsOfUseAgree(): string {
        return this.getTermsOfUseProp('build-scan-terms-of-use-agree', 'build-scan-terms-of-service-agree')
    }

    getDevelocityAccessKey(): string {
        return (
            core.getInput('develocity-access-key') ||
            process.env[BuildScanConfig.DevelocityAccessKeyEnvVar] ||
            process.env[BuildScanConfig.GradleEnterpriseAccessKeyEnvVar] ||
            ''
        )
    }

    getDevelocityTokenExpiry(): string {
        return core.getInput('develocity-token-expiry')
    }

    getDevelocityInjectionEnabled(): boolean | undefined {
        return getMaybeBooleanInput('develocity-injection-enabled')
    }

    getDevelocityUrl(): string {
        return core.getInput('develocity-url')
    }

    getDevelocityAllowUntrustedServer(): boolean | undefined {
        return getMaybeBooleanInput('develocity-allow-untrusted-server')
    }

    getDevelocityCaptureFileFingerprints(): boolean | undefined {
        return getMaybeBooleanInput('develocity-capture-file-fingerprints')
    }

    getDevelocityEnforceUrl(): boolean | undefined {
        return getMaybeBooleanInput('develocity-enforce-url')
    }

    getDevelocityPluginVersion(): string {
        return core.getInput('develocity-plugin-version')
    }

    getDevelocityCcudPluginVersion(): string {
        return core.getInput('develocity-ccud-plugin-version')
    }

    getGradlePluginRepositoryUrl(): string {
        return core.getInput('gradle-plugin-repository-url')
    }

    getGradlePluginRepositoryUsername(): string {
        return core.getInput('gradle-plugin-repository-username')
    }

    getGradlePluginRepositoryPassword(): string {
        return core.getInput('gradle-plugin-repository-password')
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
        const oldProp = core.getInput(oldPropName)
        if (oldProp !== '') {
            deprecator.recordDeprecation('The `build-scan-terms-of-service` input parameters have been renamed')
            return oldProp
        }
        return core.getInput(oldPropName)
    }
}

export class GradleExecutionConfig {
    getGradleVersion(): string {
        return core.getInput('gradle-version')
    }

    getBuildRootDirectory(): string {
        const baseDirectory = getWorkspaceDirectory()
        const buildRootDirectoryInput = core.getInput('build-root-directory')
        const resolvedBuildRootDirectory =
            buildRootDirectoryInput === ''
                ? path.resolve(baseDirectory)
                : path.resolve(baseDirectory, buildRootDirectoryInput)
        return resolvedBuildRootDirectory
    }

    getArguments(): string[] {
        const input = core.getInput('arguments')
        if (input.length !== 0) {
            deprecator.recordDeprecation(
                'Using the action to execute Gradle via the `arguments` parameter is deprecated'
            )
        }
        return parseArgsStringToArgv(input)
    }

    getDependencyResolutionTask(): string {
        return core.getInput('dependency-resolution-task') || ':ForceDependencyResolutionPlugin_resolveAllDependencies'
    }

    getAdditionalArguments(): string {
        return core.getInput('additional-arguments')
    }
}

export function doValidateWrappers(): boolean {
    return getBooleanInput('validate-wrappers')
}

// Internal parameters
export function getJobMatrix(): string {
    return core.getInput('workflow-job-context')
}

export function getGithubToken(): string {
    return core.getInput('github-token', {required: true})
}

export function getWorkspaceDirectory(): string {
    return process.env[`GITHUB_WORKSPACE`] || ''
}

export function getActionId(): string | undefined {
    return process.env[ACTION_ID_VAR]
}

export function setActionId(id: string): void {
    core.exportVariable(ACTION_ID_VAR, id)
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

function getMaybeBooleanInput(paramName: string): boolean | undefined {
    const paramValue = core.getInput(paramName)
    switch (paramValue?.toLowerCase().trim()) {
        case 'false':
            return false
        case 'true':
            return true
        default:
            return undefined
    }
}
