import * as core from '@actions/core'
import {getBuildScanPublishEnabled, getBuildScanTermsOfUseUrl, getBuildScanTermsOfUseAgree} from './input-params'

export function setup(): void {
    if (getBuildScanPublishEnabled() && verifyTermsOfUseAgreement()) {
        maybeExportVariable('DEVELOCITY_INJECTION_INIT_SCRIPT_NAME', 'gradle-actions.inject-develocity.init.gradle')
        maybeExportVariable('DEVELOCITY_INJECTION_ENABLED', 'true')
        maybeExportVariable('DEVELOCITY_PLUGIN_VERSION', '3.16.2')
        maybeExportVariable('DEVELOCITY_CCUD_PLUGIN_VERSION', '1.13')
        maybeExportVariable('BUILD_SCAN_TERMS_OF_USE_URL', getBuildScanTermsOfUseUrl())
        maybeExportVariable('BUILD_SCAN_TERMS_OF_USE_AGREE', getBuildScanTermsOfUseAgree())
    }
}

function verifyTermsOfUseAgreement(): boolean {
    if (
        getBuildScanTermsOfUseUrl() !== 'https://gradle.com/terms-of-service' ||
        getBuildScanTermsOfUseUrl() !== 'https://gradle.com/help/legal-terms-of-use' ||
        getBuildScanTermsOfUseAgree() !== 'yes'
    ) {
        core.warning(`Terms of use must be agreed in order to publish build scans.`)
        return false
    }
    return true
}

function maybeExportVariable(variableName: string, value: unknown): void {
    if (!process.env[variableName]) {
        core.exportVariable(variableName, value)
    }
}
