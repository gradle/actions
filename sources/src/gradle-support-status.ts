import * as core from '@actions/core'
import * as semver from 'semver'

import {GradleVersion} from './execution/gradle-version'
import wrapperChecksums from './wrapper-validation/wrapper-checksums.json'

const FEATURE_LIFECYCLE_DOC = 'https://docs.gradle.org/current/userguide/feature_lifecycle.html#eol_support'

const RELEASED_VERSIONS = wrapperChecksums
    .map(entry => entry.version)
    .filter(version => new GradleVersion(version).isFinalRelease())

const LATEST_RELEASED_MAJOR = determineLatestReleasedMajor(RELEASED_VERSIONS)

const LATEST_PATCHES = latestPatchByMinorLine(RELEASED_VERSIONS)

export enum SupportStatusKind {
    Active = 'active',
    Maintenance = 'maintenance',
    Eol = 'eol',
    PatchAvailable = 'patch-available'
}

export type SupportStatus =
    | {kind: SupportStatusKind.Active}
    | {kind: SupportStatusKind.Maintenance}
    | {kind: SupportStatusKind.Eol}
    | {kind: SupportStatusKind.PatchAvailable; newerPatch: string}

function determineLatestReleasedMajor(versions: string[]): number {
    const releasedMajors = versions
        .map(version => new GradleVersion(version))
        .filter(parsed => parsed.isFinalRelease())
        .map(parsed => parsed.major)
    return Math.max(0, ...releasedMajors)
}

type LatestPatches = Map<string, semver.SemVer>

function getSupportStatus(version: GradleVersion, latestMajor: number, latestPatches: LatestPatches): SupportStatus {
    switch (Math.max(0, latestMajor - version.major)) {
        case 0: {
            const newerPatch = findNewerPatch(version.version, latestPatches)
            return newerPatch ? {kind: SupportStatusKind.PatchAvailable, newerPatch} : {kind: SupportStatusKind.Active}
        }
        case 1:
            return {kind: SupportStatusKind.Maintenance}
        default:
            return {kind: SupportStatusKind.Eol}
    }
}

function latestPatchByMinorLine(releasedVersions: string[]): LatestPatches {
    const latestPatches: LatestPatches = new Map()
    for (const released of releasedVersions) {
        const version = semver.coerce(released)
        if (!version) {
            continue
        }
        const minorLine = `${version.major}.${version.minor}`
        const known = latestPatches.get(minorLine)
        if (!known || semver.gt(version, known)) {
            latestPatches.set(minorLine, version)
        }
    }
    return latestPatches
}

function findNewerPatch(gradleVersion: string, latestPatches: LatestPatches): string | undefined {
    const current = semver.coerce(gradleVersion)
    if (!current || !new GradleVersion(gradleVersion).isFinalRelease()) {
        return undefined
    }

    const latest = latestPatches.get(`${current.major}.${current.minor}`)
    return latest && semver.gt(latest, current) ? latest.version : undefined
}

export function supportStatusOf(gradleVersion: string): SupportStatus {
    return getSupportStatus(new GradleVersion(gradleVersion), LATEST_RELEASED_MAJOR, LATEST_PATCHES)
}

/** Entry point for tests */
export function supportStatusUsing(gradleVersion: string, releasedVersions: string[]): SupportStatus {
    return getSupportStatus(
        new GradleVersion(gradleVersion),
        determineLatestReleasedMajor(releasedVersions),
        latestPatchByMinorLine(releasedVersions)
    )
}

export function reportSupportStatus(gradleVersions: string[]): void {
    reportOutdatedVersions(gradleVersions, LATEST_RELEASED_MAJOR, LATEST_PATCHES)
}

/** Entry point for tests */
export function reportSupportStatusUsing(gradleVersions: string[], releasedVersions: string[]): void {
    reportOutdatedVersions(
        gradleVersions,
        determineLatestReleasedMajor(releasedVersions),
        latestPatchByMinorLine(releasedVersions)
    )
}

function reportOutdatedVersions(gradleVersions: string[], latestMajor: number, latestPatches: LatestPatches): void {
    for (const gradleVersion of new Set(gradleVersions)) {
        const version = new GradleVersion(gradleVersion)
        const support = getSupportStatus(version, latestMajor, latestPatches)
        switch (support.kind) {
            case SupportStatusKind.Eol:
                core.warning(eolMessage(version, latestMajor), {title: 'Gradle version at end-of-life'})
                break
            case SupportStatusKind.Maintenance:
                core.notice(maintenanceMessage(version, latestMajor), {title: 'Gradle version in maintenance'})
                break
            case SupportStatusKind.PatchAvailable:
                core.notice(patchMessage(version, support.newerPatch), {title: 'Gradle patch update available'})
                break
        }
    }
}

function patchMessage(version: GradleVersion, newerPatch: string): string {
    return `Gradle ${version.version} is not the latest patch release: Gradle ${newerPatch} is available in the same release line, and upgrading is recommended. See ${FEATURE_LIFECYCLE_DOC}`
}

function eolMessage(version: GradleVersion, latestMajor: number): string {
    return `Gradle ${version.version} has reached end-of-life: the ${version.major}.x release line no longer receives bug fixes or security fixes. Gradle ${latestMajor}.x is the current release line, and upgrading is recommended. See ${FEATURE_LIFECYCLE_DOC}`
}

function maintenanceMessage(version: GradleVersion, latestMajor: number): string {
    return `Gradle ${version.version} is in maintenance-only support: the ${version.major}.x release line receives critical bug fixes and security fixes only, and reaches end-of-life when Gradle ${latestMajor + 1} is released. Consider upgrading to Gradle ${latestMajor}.x. See ${FEATURE_LIFECYCLE_DOC}`
}
