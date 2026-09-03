import * as core from '@actions/core'

import {GradleVersion} from './execution/gradle-version'
import wrapperChecksums from './wrapper-validation/wrapper-checksums.json'

/** Minor lines behind the latest that stay unreported on the current major. */
const MINOR_GRACE = 2

export const SECURITY_SUBSCRIPTION = 'https://gradle.org/security-subscription/?utm_source=github-action'
export const FEATURE_LIFECYCLE_DOC = 'https://docs.gradle.org/current/userguide/feature_lifecycle.html#eol_support'

export enum SupportStatusKind {
    Current = 'current',
    Behind = 'behind',
    Eol = 'eol'
}

class ReleaseIndex {
    readonly latestMajor: number
    private readonly latest: GradleVersion | undefined
    private readonly latestByMajor = new Map<number, GradleVersion>()

    constructor(releasedVersions: string[]) {
        const finals = releasedVersions
            .map(version => GradleVersion.parse(version))
            .filter((version): version is GradleVersion => version !== undefined && version.isFinalRelease())
            .sort(GradleVersion.compare)

        // Ascending, so the last write per key wins.
        for (const version of finals) {
            this.latestByMajor.set(version.major, version)
        }
        this.latest = finals[finals.length - 1]
        this.latestMajor = this.latest?.major ?? 0
    }

    private latestMinorOf(major: number): number {
        return this.latestByMajor.get(major)?.minor ?? -1
    }

    classify(version: GradleVersion): SupportStatusKind {
        if (this.latest === undefined || !version.isFinalRelease()) {
            return SupportStatusKind.Current
        }

        const majorsBehind = this.latestMajor - version.major
        if (majorsBehind >= 2) {
            return SupportStatusKind.Eol
        }
        if (majorsBehind === 1) {
            return SupportStatusKind.Behind
        }
        if (version.major !== this.latestMajor) {
            return SupportStatusKind.Current // newer than the bundled data knows about
        }
        return this.latestMinorOf(version.major) - version.minor > MINOR_GRACE
            ? SupportStatusKind.Behind
            : SupportStatusKind.Current
    }
}

const RELEASES = new ReleaseIndex(wrapperChecksums.map(entry => entry.version))

function classified(gradleVersions: string[], releases: ReleaseIndex): Map<SupportStatusKind, GradleVersion[]> {
    const byKind = new Map<SupportStatusKind, GradleVersion[]>()
    const parsed = [...new Set(gradleVersions)]
        .map(version => GradleVersion.parse(version))
        .filter((version): version is GradleVersion => version !== undefined)
        .sort(GradleVersion.compare)

    for (const version of parsed) {
        const kind = releases.classify(version)
        if (kind !== SupportStatusKind.Current) {
            byKind.set(kind, [...(byKind.get(kind) ?? []), version])
        }
    }
    return byKind
}

function report(gradleVersions: string[], releases: ReleaseIndex): void {
    const byKind = classified(gradleVersions, releases)
    for (const version of byKind.get(SupportStatusKind.Eol) ?? []) {
        core.warning(
            `Gradle ${version.version} is end-of-life: the ${version.major}.x release line receives no new fixes of any kind, including security fixes. Update to the latest Gradle version. Options for staying secure on an end-of-life version: ${SECURITY_SUBSCRIPTION}`,
            {title: 'Gradle version at end-of-life'}
        )
    }
    for (const version of byKind.get(SupportStatusKind.Behind) ?? []) {
        core.notice(
            `Gradle ${version.version} is out of date: consider updating to the latest Gradle version. See ${FEATURE_LIFECYCLE_DOC}`,
            {title: 'Gradle version out of date'}
        )
    }
}

/** Flagged versions grouped by kind (Current omitted), for the job-summary report. */
export function classifySupportStatus(gradleVersions: string[]): Map<SupportStatusKind, GradleVersion[]> {
    return classified(gradleVersions, RELEASES)
}

/** The support status of a single version. */
export function supportStatusOf(gradleVersion: string): SupportStatusKind {
    const version = GradleVersion.parse(gradleVersion)
    return version ? RELEASES.classify(version) : SupportStatusKind.Current
}

export function reportSupportStatus(gradleVersions: string[]): void {
    report(gradleVersions, RELEASES)
}

/** Entry points for tests */
export function supportStatusUsing(gradleVersion: string, releasedVersions: string[]): SupportStatusKind {
    const version = GradleVersion.parse(gradleVersion)
    return version ? new ReleaseIndex(releasedVersions).classify(version) : SupportStatusKind.Current
}

export function classifySupportStatusUsing(
    gradleVersions: string[],
    releasedVersions: string[]
): Map<SupportStatusKind, GradleVersion[]> {
    return classified(gradleVersions, new ReleaseIndex(releasedVersions))
}

export function reportSupportStatusUsing(gradleVersions: string[], releasedVersions: string[]): void {
    report(gradleVersions, new ReleaseIndex(releasedVersions))
}
