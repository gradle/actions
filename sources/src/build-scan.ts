import * as core from '@actions/core'
import {BuildScanConfig} from './configuration'
import {getToken} from './shortlived-token/shortlived-token'

export async function setup(config: BuildScanConfig): Promise<void> {
    maybeExportVariable('DEVELOCITY_INJECTION_INIT_SCRIPT_NAME', 'gradle-actions.inject-develocity.init.gradle')
    maybeExportVariable('DEVELOCITY_AUTO_INJECTION_CUSTOM_VALUE', 'gradle-actions')
    if (config.getBuildScanPublishEnabled()) {
        maybeExportVariable('DEVELOCITY_INJECTION_ENABLED', 'true')
        maybeExportVariable('DEVELOCITY_PLUGIN_VERSION', '3.17.3')
        maybeExportVariable('DEVELOCITY_CCUD_PLUGIN_VERSION', '2.0')
        maybeExportVariable('DEVELOCITY_TERMS_OF_USE_URL', config.getBuildScanTermsOfUseUrl())
        maybeExportVariable('DEVELOCITY_TERMS_OF_USE_AGREE', config.getBuildScanTermsOfUseAgree())
    }
    const develocityAccesskeyEnvVar = `DEVELOCITY_ACCESS_KEY`
    if (config.getDevelocityAccessKey()) {
        try {
            core.debug('Fetching short-lived token...')
            const tokens = await getToken(
                getEnv('DEVELOCITY_ENFORCE_URL'),
                getEnv('DEVELOCITY_URL'),
                config.getDevelocityAccessKey(),
                config.getDevelocityTokenExpiry()
            )
            if (tokens != null && !tokens.isEmpty()) {
                core.debug(`Got token(s), setting the ${develocityAccesskeyEnvVar} env var`)
                const token = tokens.raw()
                core.setSecret(token)
                core.exportVariable(develocityAccesskeyEnvVar, token)
            } else {
                // In case of not being able to generate a token we set the env variable to empty to avoid leaks
                core.exportVariable(develocityAccesskeyEnvVar, '')
            }
        } catch (e) {
            core.exportVariable(develocityAccesskeyEnvVar, '')
            core.warning(`Failed to fetch short-lived token, reason: ${e}`)
        }
    }
}

function getEnv(variableName: string): string | undefined {
    return process.env[variableName]
}

function maybeExportVariable(variableName: string, value: unknown): void {
    if (!process.env[variableName]) {
        core.exportVariable(variableName, value)
    }
}
