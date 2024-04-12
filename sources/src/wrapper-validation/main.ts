import * as path from 'path'
import * as core from '@actions/core'

import * as validate from './validate'
import {getActionId, setActionId} from '../configuration'
import {recordDeprecation, emitDeprecationWarnings} from '../deprecation-collector'
import {handleMainActionError} from '../errors'

export async function run(): Promise<void> {
    try {
        if (getActionId() === 'gradle/wrapper-validation-action') {
            recordDeprecation(
                'The action `gradle/wrapper-validation-action` has been replaced by `gradle/actions/wrapper-validation`'
            )
        } else {
            setActionId('gradle/actions/wrapper-validation')
        }

        const result = await validate.findInvalidWrapperJars(
            path.resolve('.'),
            +core.getInput('min-wrapper-count'),
            core.getInput('allow-snapshots') === 'true',
            core.getInput('allow-checksums').split(',')
        )
        if (result.isValid()) {
            core.info(result.toDisplayString())
        } else {
            core.setFailed(
                `Gradle Wrapper Validation Failed!\n  See https://github.com/gradle/actions/blob/main/docs/wrapper-validation.md#reporting-failures\n${result.toDisplayString()}`
            )
            if (result.invalid.length > 0) {
                core.setOutput('failed-wrapper', `${result.invalid.map(w => w.path).join('|')}`)
            }
        }

        emitDeprecationWarnings(false)
    } catch (error) {
        handleMainActionError(error)
    }
}

run()
