import * as core from '@actions/core'
import * as exec from '@actions/exec'

import * as semver from 'semver'

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

export function versionIsAtLeast(actualVersion: string, requiredVersion: string): boolean {
    const splitVersion = actualVersion.split('-')
    const coreVersion = splitVersion[0]
    const prerelease = splitVersion.length > 1

    const actualSemver = semver.coerce(coreVersion)!
    const comparisonSemver = semver.coerce(requiredVersion)!

    if (prerelease) {
        return semver.gt(actualSemver, comparisonSemver)
    } else {
        return semver.gte(actualSemver, comparisonSemver)
    }
}
