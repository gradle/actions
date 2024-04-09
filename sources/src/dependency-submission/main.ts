import * as core from '@actions/core'

import * as setupGradle from '../setup-gradle'
import * as gradle from '../execution/gradle'
import * as dependencyGraph from '../dependency-graph'

import {parseArgsStringToArgv} from 'string-argv'
import {
    BuildScanConfig,
    CacheConfig,
    DependencyGraphConfig,
    DependencyGraphOption,
    GradleExecutionConfig
} from '../configuration'
import {saveDeprecationState} from '../deprecation-collector'

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

        // Only execute if arguments have been provided
        const executionConfig = new GradleExecutionConfig()
        const taskList = executionConfig.getDependencyResolutionTask()
        const additionalArgs = executionConfig.getAdditionalArguments()
        const executionArgs = `
              -Dorg.gradle.configureondemand=false
              -Dorg.gradle.dependency.verification=off
              -Dorg.gradle.unsafe.isolated-projects=false
              ${taskList}
              ${additionalArgs}
        `
        const args: string[] = parseArgsStringToArgv(executionArgs)
        await gradle.provisionAndMaybeExecute(
            executionConfig.getGradleVersion(),
            executionConfig.getBuildRootDirectory(),
            args
        )

        await dependencyGraph.complete(config)

        saveDeprecationState()
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
