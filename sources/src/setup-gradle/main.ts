import * as core from '@actions/core'

import * as setupGradle from '../setup-gradle'
import * as execution from '../execution'
import * as provisioner from '../provision'
import * as layout from '../repository-layout'
import * as dependencyGraph from '../dependency-graph'
import {BuildScanConfig, CacheConfig, DependencyGraphConfig, getArguments} from '../input-params'

/**
 * The main entry point for the action, called by Github Actions for the step.
 */
export async function run(): Promise<void> {
    try {
        // Configure Gradle environment (Gradle User Home)
        await setupGradle.setup(new CacheConfig(), new BuildScanConfig())

        // Configure the dependency graph submission
        await dependencyGraph.setup(new DependencyGraphConfig())

        // Download and install Gradle if required
        const executable = await provisioner.provisionGradle()

        // Only execute if arguments have been provided
        const args: string[] = getArguments()
        if (args.length > 0) {
            const buildRootDirectory = layout.buildRootDirectory()
            await execution.executeGradleBuild(executable, buildRootDirectory, args)
        }
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
