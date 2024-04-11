import * as setupGradle from '../setup-gradle'
import * as gradle from '../execution/gradle'
import * as dependencyGraph from '../dependency-graph'
import {
    BuildScanConfig,
    CacheConfig,
    DependencyGraphConfig,
    GradleExecutionConfig,
    doValidateWrappers,
    getActionId,
    setActionId
} from '../configuration'
import {recordDeprecation, saveDeprecationState} from '../deprecation-collector'
import {handleMainActionError} from '../errors'

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

        // Check for invalid wrapper JARs if requested
        if (doValidateWrappers()) {
            await setupGradle.checkNoInvalidWrapperJars()
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
        handleMainActionError(error)
    }

    // Explicit process.exit() to prevent waiting for hanging promises.
    process.exit()
}

run()
