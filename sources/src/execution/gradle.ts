import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as path from 'path'

import * as params from '../input-params'
import * as provisioner from './provision'
import * as gradlew from './gradlew'
import {getWorkspaceDirectory} from '../input-params'

export async function provisionAndMaybeExecute(args: string[]): Promise<void> {
    // Download and install Gradle if required
    const executable = await provisioner.provisionGradle()

    // Only execute if arguments have been provided
    if (args.length > 0) {
        await executeGradleBuild(executable, buildRootDirectory(), args)
    }
}

async function executeGradleBuild(executable: string | undefined, root: string, args: string[]): Promise<void> {
    // Use the provided executable, or look for a Gradle wrapper script to run
    const toExecute = executable ?? gradlew.gradleWrapperScript(root)

    const status: number = await exec.exec(toExecute, args, {
        cwd: root,
        ignoreReturnCode: true
    })

    if (status !== 0) {
        core.setFailed(`Gradle build failed: see console output for details`)
    }
}

function buildRootDirectory(): string {
    const baseDirectory = getWorkspaceDirectory()
    const buildRootDirectoryInput = params.getBuildRootDirectory()
    const resolvedBuildRootDirectory =
        buildRootDirectoryInput === ''
            ? path.resolve(baseDirectory)
            : path.resolve(baseDirectory, buildRootDirectoryInput)
    return resolvedBuildRootDirectory
}
