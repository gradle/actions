import * as core from '@actions/core'

import * as setupGradle from '../setup-gradle'
import * as execution from '../execution'
import * as provisioner from '../provision'
import * as layout from '../repository-layout'
import {parseArgsStringToArgv} from 'string-argv'
import {DependencyGraphOption, getDependencyGraphOption} from '../input-params'

/**
 * The main entry point for the action, called by Github Actions for the step.
 */
export async function run(): Promise<void> {
    try {
        if (process.env['GRADLE_BUILD_ACTION_SETUP_COMPLETED']) {
            core.setFailed(
                'The dependency-submission action cannot be used in the same Job as the setup-gradle action. Please use a separate Job for dependency submission.'
            )
            return
        }

        // Configure Gradle environment (Gradle User Home)
        await setupGradle.setup()

        if (getDependencyGraphOption() === DependencyGraphOption.DownloadAndSubmit) {
            // No execution to perform
            return
        }

        // Download and install Gradle if required
        const executable = await provisioner.provisionGradle()

        // Only execute if arguments have been provided
        const additionalArgs = core.getInput('additional-arguments')
        const executionArgs = `
              -Dorg.gradle.configureondemand=false
              -Dorg.gradle.dependency.verification=off
              -Dorg.gradle.unsafe.isolated-projects=false
              :ForceDependencyResolutionPlugin_resolveAllDependencies
              ${additionalArgs}
        `

        const args: string[] = parseArgsStringToArgv(executionArgs)
        core.info(args.join('!!!'))
        const buildRootDirectory = layout.buildRootDirectory()
        await execution.executeGradleBuild(executable, buildRootDirectory, args)
    } catch (error) {
        core.setFailed(String(error))
        if (error instanceof Error && error.stack) {
            core.info(error.stack)
        }
    }

    // Explicit process.exit() to prevent waiting for hanging promises.
    process.exit()
}

run()
