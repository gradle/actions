import * as core from '@actions/core'
import {BuildScanConfig} from '../configuration'
import {setupToken} from './short-lived-token'

export async function setup(config: BuildScanConfig): Promise<void> {
    maybeExportVariable('DEVELOCITY_INJECTION_INIT_SCRIPT_NAME', 'gradle-actions.inject-develocity.init.gradle')
    maybeExportVariable('DEVELOCITY_AUTO_INJECTION_CUSTOM_VALUE', 'gradle-actions')
    if (config.getBuildScanPublishEnabled()) {
        maybeExportVariable('DEVELOCITY_INJECTION_ENABLED', 'true')
        maybeExportVariable('DEVELOCITY_PLUGIN_VERSION', '3.17.5')
        maybeExportVariable('DEVELOCITY_CCUD_PLUGIN_VERSION', '2.0')
        maybeExportVariable('DEVELOCITY_TERMS_OF_USE_URL', config.getBuildScanTermsOfUseUrl())
        maybeExportVariable('DEVELOCITY_TERMS_OF_USE_AGREE', config.getBuildScanTermsOfUseAgree())
    }
    setupToken(
        config.getDevelocityAccessKey(),
        config.getDevelocityTokenExpiry(),
        getEnv('DEVELOCITY_ENFORCE_URL'),
        getEnv('DEVELOCITY_URL')
    )
}

function getEnv(variableName: string): string | undefined {
    return process.env[variableName]
}

function maybeExportVariable(variableName: string, value: unknown): void {
    if (!process.env[variableName]) {
        core.exportVariable(variableName, value)
    }
}
