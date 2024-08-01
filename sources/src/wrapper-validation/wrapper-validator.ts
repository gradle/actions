import * as core from '@actions/core'

import {WrapperValidationConfig} from '../configuration'
import {ChecksumCache} from './cache'
import {findInvalidWrapperJars} from './validate'
import {JobFailure} from '../errors'

export async function validateWrappers(
    config: WrapperValidationConfig,
    workspaceRoot: string,
    gradleUserHome: string
): Promise<void> {
    if (!config.doValidateWrappers()) {
        return // Wrapper validation is disabled
    }
    const checksumCache = new ChecksumCache(gradleUserHome)

    const allowedChecksums = process.env['ALLOWED_GRADLE_WRAPPER_CHECKSUMS']?.split(',') || []
    const previouslyValidatedChecksums = checksumCache.load()

    const result = await findInvalidWrapperJars(
        workspaceRoot,
        0,
        config.allowSnapshotWrappers(),
        allowedChecksums,
        previouslyValidatedChecksums
    )
    if (result.isValid()) {
        await core.group('All Gradle Wrapper jars are valid', async () => {
            core.info(`Loaded previously validated checksums from cache: ${previouslyValidatedChecksums.join(', ')}`)
            core.info(result.toDisplayString())
        })
    } else {
        core.info(result.toDisplayString())
        throw new JobFailure(
            `Gradle Wrapper Validation Failed!\n  See https://github.com/gradle/actions/blob/main/docs/wrapper-validation.md#validation-failures\n${result.toDisplayString()}`
        )
    }

    checksumCache.save(result.valid.map(wrapper => wrapper.checksum))
}
