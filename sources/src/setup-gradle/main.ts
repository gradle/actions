import * as core from '@actions/core'

import * as setupGradle from '../setup-gradle'
import * as gradle from '../execution/gradle'
import * as dependencyGraph from '../dependency-graph'
import {
    BuildScanConfig,
    CacheConfig,
    DependencyGraphConfig,
    GradleExecutionConfig,
    getActionId,
    setActionId
} from '../configuration'
import {recordDeprecation, saveDeprecationState} from '../deprecation-collector'

/**
 * The main entry point for the action, called by Github Actions for the step.
 */
export async function run(): Promise<void> {
    try {
        if (getActionId() === 'gradle/gradle-build-action') {
            recordDeprecation(
                'The action `gradle/gradle-build-action` has been replaced by `gradle/actions/setup-gradle`'
            )
        } else {
            setActionId('gradle/actions/setup-gradle')
        }

        // Configure Gradle environment (Gradle User Home)
        await setupGradle.setup(new CacheConfig(), new BuildScanConfig())

        // Configure the dependency graph submission
        await dependencyGraph.setup(new DependencyGraphConfig())

        const config = new GradleExecutionConfig()
        await gradle.provisionAndMaybeExecute(
            config.getGradleVersion(),
            config.getBuildRootDirectory(),
            config.getArguments()
        )

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
