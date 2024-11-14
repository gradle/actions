import * as core from '@actions/core'
import {BuildScanConfig} from '../configuration'
import {setupToken} from './short-lived-token'

export async function setup(config: BuildScanConfig): Promise<void> {
    maybeExportVariable('DEVELOCITY_INJECTION_INIT_SCRIPT_NAME', 'gradle-actions.inject-develocity.init.gradle')
    maybeExportVariable('DEVELOCITY_AUTO_INJECTION_CUSTOM_VALUE', 'gradle-actions')
    if (config.getBuildScanPublishEnabled()) {
        maybeExportVariable('DEVELOCITY_INJECTION_ENABLED', 'true')
        maybeExportVariable('DEVELOCITY_PLUGIN_VERSION', '3.18.2')
        maybeExportVariable('DEVELOCITY_CCUD_PLUGIN_VERSION', '2.0')
        maybeExportVariable('DEVELOCITY_TERMS_OF_USE_URL', config.getBuildScanTermsOfUseUrl())
        maybeExportVariable('DEVELOCITY_TERMS_OF_USE_AGREE', config.getBuildScanTermsOfUseAgree())
    }

    maybeExportVariableNotEmpty('DEVELOCITY_INJECTION_ENABLED', config.getDevelocityInjectionEnabled())
    maybeExportVariableNotEmpty('DEVELOCITY_URL', config.getDevelocityUrl())
    maybeExportVariableNotEmpty('DEVELOCITY_ALLOW_UNTRUSTED_SERVER', config.getDevelocityAllowUntrustedServer())
    maybeExportVariableNotEmpty('DEVELOCITY_CAPTURE_FILE_FINGERPRINTS', config.getDevelocityCaptureFileFingerprints())
    maybeExportVariableNotEmpty('DEVELOCITY_ENFORCE_URL', config.getDevelocityEnforceUrl())
    maybeExportVariableNotEmpty('DEVELOCITY_PLUGIN_VERSION', config.getDevelocityPluginVersion())
    maybeExportVariableNotEmpty('GRADLE_PLUGIN_REPOSITORY_URL', config.getGradlePluginRepositoryUrl())
    maybeExportVariableNotEmpty('GRADLE_PLUGIN_REPOSITORY_USERNAME', config.getGradlePluginRepositoryUsername())
    maybeExportVariableNotEmpty('GRADLE_PLUGIN_REPOSITORY_PASSWORD', config.getGradlePluginRepositoryPassword())

    return setupToken(config.getDevelocityAccessKey(), config.getDevelocityTokenExpiry())
}

function maybeExportVariable(variableName: string, value: unknown): void {
    if (!process.env[variableName]) {
        core.exportVariable(variableName, value)
    }
}

function maybeExportVariableNotEmpty(variableName: string, value: unknown): void {
    if (value !== null && value !== undefined && value !== '') {
        maybeExportVariable(variableName, value)
    }
}
