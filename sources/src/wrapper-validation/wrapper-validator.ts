import * as core from '@actions/core'
import {WrapperValidationConfig} from '../configuration'
import {findInvalidWrapperJars} from './validate'
import {JobFailure} from '../errors'

export async function validateWrappers(config: WrapperValidationConfig, workspaceRoot: string): Promise<void> {
    if (!config.doValidateWrappers()) {
        return // Wrapper validation is disabled
    }

    const allowedChecksums = process.env['ALLOWED_GRADLE_WRAPPER_CHECKSUMS']?.split(',') || []
    const result = await findInvalidWrapperJars(workspaceRoot, 0, config.allowSnapshotWrappers(), allowedChecksums)
    if (result.isValid()) {
        await core.group('All Gradle Wrapper jars are valid', async () => {
            core.info(result.toDisplayString())
        })
    } else {
        core.info(result.toDisplayString())
        throw new JobFailure(
            `Gradle Wrapper Validation Failed!\n  See https://github.com/gradle/actions/blob/main/docs/wrapper-validation.md#reporting-failures\n${result.toDisplayString()}`
        )
    }
}
