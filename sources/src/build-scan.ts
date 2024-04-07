import * as core from '@actions/core'
import {BuildScanConfig} from './input-params'

export function setup(config: BuildScanConfig): void {
    maybeExportVariable('DEVELOCITY_INJECTION_INIT_SCRIPT_NAME', 'gradle-actions.inject-develocity.init.gradle')
    maybeExportVariable('DEVELOCITY_AUTO_INJECTION_CUSTOM_VALUE', 'gradle-actions')
    if (config.getBuildScanPublishEnabled()) {
        maybeExportVariable('DEVELOCITY_INJECTION_ENABLED', 'true')
        maybeExportVariable('DEVELOCITY_PLUGIN_VERSION', '3.17')
        maybeExportVariable('DEVELOCITY_CCUD_PLUGIN_VERSION', '1.13')
        maybeExportVariable('DEVELOCITY_TERMS_OF_USE_URL', config.getBuildScanTermsOfUseUrl())
        maybeExportVariable('DEVELOCITY_TERMS_OF_USE_AGREE', config.getBuildScanTermsOfUseAgree())
    }
}

function maybeExportVariable(variableName: string, value: unknown): void {
    if (!process.env[variableName]) {
        core.exportVariable(variableName, value)
    }
}
