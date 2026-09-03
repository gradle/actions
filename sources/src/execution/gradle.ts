import * as core from '@actions/core'
import * as exec from '@actions/exec'

import which from 'which'
import * as provisioner from './provision'
import * as gradlew from './gradlew'

export async function provisionAndMaybeExecute(
    gradleVersion: string,
    buildRootDirectory: string,
    args: string[]
): Promise<void> {
    // Download and install Gradle if required
    const executable = await provisioner.provisionGradle(gradleVersion)

    // Only execute if arguments have been provided
    if (args.length > 0) {
        await executeGradleBuild(executable, buildRootDirectory, args)
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

export async function findGradleExecutableOnPath(): Promise<string | null> {
    return await which('gradle', {nothrow: true})
}

export async function determineGradleVersion(gradleExecutable: string): Promise<string | undefined> {
    const output = await exec.getExecOutput(gradleExecutable, ['-v'], {silent: true})
    return parseGradleVersionFromOutput(output.stdout)
}

export function parseGradleVersionFromOutput(output: string): string | undefined {
    const regex = /Gradle (\d+\.\d+(\.\d+)?(-.*)?)/
    const versionString = output.match(regex)?.[1]
    return versionString
}
