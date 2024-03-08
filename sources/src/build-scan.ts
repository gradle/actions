import * as core from '@actions/core'
import {getBuildScanPublishEnabled, getBuildScanTermsOfUseUrl, getBuildScanTermsOfUseAgree} from './input-params'

export function setup(): void {
    if (getBuildScanPublishEnabled() && verifyTermsOfServiceAgreement()) {
        maybeExportVariable('DEVELOCITY_INJECTION_ENABLED', 'true')
        maybeExportVariable('DEVELOCITY_PLUGIN_VERSION', '3.16.2')
        maybeExportVariable('DEVELOCITY_CCUD_PLUGIN_VERSION', '1.13')
        maybeExportVariable('BUILD_SCAN_TERMS_OF_SERVICE_URL', getBuildScanTermsOfUseUrl())
        maybeExportVariable('BUILD_SCAN_TERMS_OF_SERVICE_AGREE', getBuildScanTermsOfUseAgree())
    }
}

function verifyTermsOfServiceAgreement(): boolean {
    if (
        getBuildScanTermsOfUseUrl() !== 'https://gradle.com/terms-of-service' ||
        getBuildScanTermsOfUseUrl() !== 'https://gradle.com/legal/terms-of-use' ||
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
