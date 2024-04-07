import * as core from '@actions/core'

import * as setupGradle from '../setup-gradle'
import * as execution from '../execution'
import * as provisioner from '../provision'
import * as layout from '../repository-layout'
import * as dependencyGraph from '../dependency-graph'

import {parseArgsStringToArgv} from 'string-argv'
import {BuildScanConfig, CacheConfig, DependencyGraphConfig, DependencyGraphOption} from '../input-params'

/**
 * The main entry point for the action, called by Github Actions for the step.
 */
export async function run(): Promise<void> {
    try {
        // Configure Gradle environment (Gradle User Home)
        await setupGradle.setup(new CacheConfig(), new BuildScanConfig())

        // Configure the dependency graph submission
        const config = new DependencyGraphConfig()
        await dependencyGraph.setup(config)

        if (config.getDependencyGraphOption() === DependencyGraphOption.DownloadAndSubmit) {
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
