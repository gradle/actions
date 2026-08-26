import * as core from '@actions/core'

import {GradleVersion} from './execution/gradle-version'
import wrapperChecksums from './wrapper-validation/wrapper-checksums.json'

const FEATURE_LIFECYCLE_DOC = 'https://docs.gradle.org/current/userguide/feature_lifecycle.html#eol_support'

const LATEST_RELEASED_MAJOR = determineLatestReleasedMajor(wrapperChecksums.map(entry => entry.version))

export type SupportStatus = 'active' | 'maintenance' | 'eol'

export function determineLatestReleasedMajor(versions: string[]): number | undefined {
    const releasedMajors = versions
        .map(version => new GradleVersion(version))
        .filter(parsed => parsed.isFinalRelease())
        .map(parsed => parsed.major)
    return releasedMajors.length > 0 ? Math.max(...releasedMajors) : undefined
}

export function getSupportStatus(version: GradleVersion, latestMajor: number): SupportStatus {
    switch (Math.max(0, latestMajor - version.major)) {
        case 0:
            return 'active'
        case 1:
            return 'maintenance'
        default:
            return 'eol'
    }
}

export function supportStatusOf(gradleVersion: string): SupportStatus | undefined {
    if (LATEST_RELEASED_MAJOR === undefined) {
        return undefined
    }
    return getSupportStatus(new GradleVersion(gradleVersion), LATEST_RELEASED_MAJOR)
}

export function reportSupportStatus(gradleVersions: string[]): void {
    if (LATEST_RELEASED_MAJOR === undefined) {
        return
    }

    for (const gradleVersion of new Set(gradleVersions)) {
        const version = new GradleVersion(gradleVersion)
        switch (getSupportStatus(version, LATEST_RELEASED_MAJOR)) {
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
