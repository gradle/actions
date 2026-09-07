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
    private readonly latest: GradleVersion

    constructor(releasedVersions: string[]) {
        const none = new GradleVersion('0.0')
        const latest = releasedVersions
            .map(version => new GradleVersion(version))
            .filter(version => version.isFinalRelease())
            .reduce((max, version) => (max.compareTo(version) >= 0 ? max : version), none)

        if (latest === none) {
            throw new Error('The Gradle release data contains no final release')
        }

        this.latest = latest
    }

    private classifyVersion(version: GradleVersion): SupportStatusKind {
        if (!version.isFinalRelease()) {
            return SupportStatusKind.Current
        }

        const majorsBehind = this.latest.major - version.major
        if (majorsBehind >= 2) {
            return SupportStatusKind.Eol
        }
        if (majorsBehind === 1) {
            return SupportStatusKind.Behind
        }
        if (version.major > this.latest.major) {
            return SupportStatusKind.Current // newer than the bundled data knows about
        }
        // Same major as the latest release: only minor distance matters, patch drift inside the grace band is silent.
        return this.latest.minor - version.minor > MINOR_GRACE ? SupportStatusKind.Behind : SupportStatusKind.Current
    }

    /** Support status of a single version; an unparseable string is treated as current. */
    classify(gradleVersion: string): SupportStatusKind {
        const version = GradleVersion.parseUntrusted(gradleVersion)
        return version ? this.classifyVersion(version) : SupportStatusKind.Current
    }

    /** The flagged versions grouped by kind (Current omitted). */
    classified(gradleVersions: string[]): Map<SupportStatusKind, GradleVersion[]> {
        const byKind = new Map<SupportStatusKind, GradleVersion[]>()
        const parsed = [...new Set(gradleVersions)]
            .map(version => GradleVersion.parseUntrusted(version))
            .filter((version): version is GradleVersion => version !== undefined)
            .sort(GradleVersion.compare)

        for (const version of parsed) {
            const kind = this.classifyVersion(version)
            if (kind !== SupportStatusKind.Current) {
                byKind.set(kind, [...(byKind.get(kind) ?? []), version])
            }
        }
        return byKind
    }
}

const RELEASES = new ReleaseIndex(wrapperChecksums.map(entry => entry.version))

function report(byKind: Map<SupportStatusKind, GradleVersion[]>): void {
    for (const version of byKind.get(SupportStatusKind.Eol) ?? []) {
        core.warning(
            `Gradle ${version.version} is end-of-life. The ${version.major}.x release line receives no further fixes, security fixes included. Update to the latest Gradle version. If you cannot upgrade, see ${SECURITY_SUBSCRIPTION} for options`,
            {title: 'End-of-life Gradle version'}
        )
    }
    for (const version of byKind.get(SupportStatusKind.Behind) ?? []) {
        core.notice(
            `Gradle ${version.version} is out of date: consider updating to the latest Gradle version. See ${FEATURE_LIFECYCLE_DOC}`,
            {title: 'Out-of-date Gradle version'}
        )
    }
}

export function reportSupportStatus(gradleVersions: string[]): void {
    report(RELEASES.classified(gradleVersions))
}

export function classifySupportStatus(gradleVersions: string[]): Map<SupportStatusKind, GradleVersion[]> {
    return RELEASES.classified(gradleVersions)
}

export function supportStatusOf(gradleVersion: string): SupportStatusKind {
    return RELEASES.classify(gradleVersion)
}

/** Entry points for tests */
export function reportSupportStatusUsing(gradleVersions: string[], releasedVersions: string[]): void {
    report(new ReleaseIndex(releasedVersions).classified(gradleVersions))
}

export function supportStatusUsing(gradleVersion: string, releasedVersions: string[]): SupportStatusKind {
    return new ReleaseIndex(releasedVersions).classify(gradleVersion)
}

export function classifySupportStatusUsing(
    gradleVersions: string[],
    releasedVersions: string[]
): Map<SupportStatusKind, GradleVersion[]> {
    return new ReleaseIndex(releasedVersions).classified(gradleVersions)
}
