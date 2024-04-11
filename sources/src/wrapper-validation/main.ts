import * as path from 'path'
import * as core from '@actions/core'

import * as validate from './validate'

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
        if (error instanceof AggregateError) {
            core.setFailed(`Multiple errors returned`)
            for (const err of error.errors) {
                core.error(`Error ${error.errors.indexOf(err)}: ${err.message}`)
            }
        } else if (error instanceof Error) {
            core.setFailed(error.message)
        } else {
            core.setFailed(`Unknown object was thrown: ${error}`)
        }
    }
}

run()
