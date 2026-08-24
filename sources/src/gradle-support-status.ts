import * as core from '@actions/core'

import {BuildResult} from './build-results'
import {GradleVersion} from './execution/gradle-version'
import wrapperChecksums from './wrapper-validation/wrapper-checksums.json'

const FEATURE_LIFECYCLE_DOC = 'https://docs.gradle.org/current/userguide/feature_lifecycle.html'

const LATEST_RELEASED_MAJOR = determineLatestReleasedMajor(wrapperChecksums.map(entry => entry.version))
const LATEST_MAJOR_VERSION_ENV = 'GRADLE_ACTIONS_LATEST_GRADLE_MAJOR'

export function determineLatestReleasedMajor(versions: string[]): number | undefined {
    const releasedMajors = versions
        .map(version => new GradleVersion(version))
        .filter(parsed => parsed.isFinalRelease())
        .map(parsed => parsed.major)
    return releasedMajors.length > 0 ? Math.max(...releasedMajors) : undefined
}

export function exportLatestReleasedMajor(): void {
    if (LATEST_RELEASED_MAJOR !== undefined) {
        core.exportVariable(LATEST_MAJOR_VERSION_ENV, LATEST_RELEASED_MAJOR)
    }
}

export function reportSupportStatus(buildResults: BuildResult[]): void {
    if (LATEST_RELEASED_MAJOR === undefined) {
        return
    }

    const statusByVersion = new Map<string, string>()
    for (const {gradleVersion, versionStatus} of buildResults) {
        if (versionStatus) {
            statusByVersion.set(gradleVersion, versionStatus)
        }
    }

    for (const [gradleVersion, status] of statusByVersion) {
        const version = new GradleVersion(gradleVersion)
        switch (status) {
            case 'eol':
                core.warning(eolMessage(version, LATEST_RELEASED_MAJOR), {title: 'Gradle version at end-of-life'})
                break
            case 'maintenance':
                core.notice(maintenanceMessage(version, LATEST_RELEASED_MAJOR), {
                    title: 'Gradle version in maintenance'
                })
                break
        }
    }
}

function eolMessage(version: GradleVersion, latestMajor: number): string {
    return `Gradle ${version.version} has reached end-of-life: the ${version.major}.x release line no longer receives bug fixes or security fixes. Gradle ${latestMajor}.x is the current release line, and upgrading is recommended. See ${FEATURE_LIFECYCLE_DOC}`
}

function maintenanceMessage(version: GradleVersion, latestMajor: number): string {
    return `Gradle ${version.version} is in maintenance-only support: the ${version.major}.x release line receives critical bug fixes and security fixes only, and reaches end-of-life when Gradle ${latestMajor + 1} is released. Consider upgrading to Gradle ${latestMajor}.x. See ${FEATURE_LIFECYCLE_DOC}`
}
