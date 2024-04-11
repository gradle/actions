import * as path from 'path'
import * as core from '@actions/core'

import * as validate from './validate'
import {handleMainActionError} from '../errors'

export async function run(): Promise<void> {
    try {
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
                `Gradle Wrapper Validation Failed!\n  See https://github.com/gradle/wrapper-validation-action#reporting-failures\n${result.toDisplayString()}`
            )
            if (result.invalid.length > 0) {
                core.setOutput('failed-wrapper', `${result.invalid.map(w => w.path).join('|')}`)
            }
        }
    } catch (error) {
        handleMainActionError(error)
    }
}

run()
