import * as core from '@actions/core'
import * as path from 'path'
import * as fs from 'fs'
import * as semver from 'semver'
import {BuildResults} from './build-results-adapter'

const IS_WINDOWS = process.platform === 'win32'

class GradleVersion {
    static PATTERN = /((\d+)(\.\d+)+)(-([a-z]+)-(\w+))?(-(SNAPSHOT|\d{14}([-+]\d{4})?))?/

    versionPart: string
    stagePart: string
    snapshotPart: string

    constructor(readonly version: string) {
        const matcher = GradleVersion.PATTERN.exec(version)
        if (!matcher) {
            throw new Error(`'${version}' is not a valid Gradle version string (examples: '1.0', '1.0-rc-1')`)
        }

        this.versionPart = matcher[1]
        this.stagePart = matcher[4]
        this.snapshotPart = matcher[7]
    }
}

export function versionIsAtLeast(actualVersion: string, requiredVersion: string): boolean {
    if (actualVersion === requiredVersion) {
        return true
    }

    const actual = new GradleVersion(actualVersion)
    const required = new GradleVersion(requiredVersion)

    const actualSemver = semver.coerce(actual.versionPart)!
    const comparisonSemver = semver.coerce(required.versionPart)!

    if (semver.gt(actualSemver, comparisonSemver)) {
        return true
    }
    if (semver.lt(actualSemver, comparisonSemver)) {
        return false
    }

    if (actual.snapshotPart || required.snapshotPart) {
        if (actual.snapshotPart && !required.snapshotPart && !required.stagePart) {
            return false
        }
        if (required.snapshotPart && !actual.snapshotPart && !actual.stagePart) {
            return true
        }
        return false
    }

    if (actual.stagePart) {
        if (required.stagePart) {
            return actual.stagePart >= required.stagePart
        }
        return false
    }

    return true
}

function wrapperScriptFilename(): string {
    return IS_WINDOWS ? 'gradlew.bat' : 'gradlew'
}

/**
 * Attempts to find a Gradle wrapper script from build results that has Gradle >= 8.11.
 * Returns the full path to the wrapper script, or null if none found.
 */
export function findGradleExecutableForCleanup(buildResults: BuildResults): string | null {
    const preferredVersion = buildResults.highestGradleVersion()
    if (!preferredVersion || !versionIsAtLeast(preferredVersion, '8.11')) {
        core.info(
            `No Gradle version >= 8.11 found in build results (highest: ${preferredVersion ?? 'none'}). Cache cleanup will be skipped.`
        )
        return null
    }

    // Find a build result with the highest version that has a wrapper script
    for (const result of buildResults.results) {
        if (versionIsAtLeast(result.gradleVersion, '8.11')) {
            const wrapperScript = path.resolve(result.rootProjectDir, wrapperScriptFilename())
            if (fs.existsSync(wrapperScript)) {
                return wrapperScript
            }
        }
    }

    // Try the Gradle installation directory as a fallback
    for (const result of buildResults.results) {
        if (versionIsAtLeast(result.gradleVersion, '8.11')) {
            const executable = path.resolve(result.gradleHomeDir, 'bin', IS_WINDOWS ? 'gradle.bat' : 'gradle')
            if (fs.existsSync(executable)) {
                return executable
            }
        }
    }

    core.info('Could not locate a Gradle >= 8.11 executable for cache cleanup.')
    return null
}
