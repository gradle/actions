import * as core from '@actions/core'

import {GradleVersion} from './execution/gradle-version'
import wrapperChecksums from './wrapper-validation/wrapper-checksums.json'

/** Minor lines behind the latest that stay unreported on the current major. */
const MINOR_GRACE = 2

const SECURITY_SUBSCRIPTION = 'https://gradle.org/security-subscription/'
const FEATURE_LIFECYCLE_DOC = 'https://docs.gradle.org/current/userguide/feature_lifecycle.html#eol_support'

export enum SupportStatusKind {
    Current = 'current',
    Behind = 'behind',
    Eol = 'eol'
}

const SIGN: Record<SupportStatusKind, string> = {
    [SupportStatusKind.Current]: '',
    [SupportStatusKind.Behind]: ':information_source:',
    [SupportStatusKind.Eol]: ':warning:'
}

const UPGRADE_LEGEND = `<p>${SIGN[SupportStatusKind.Behind]} Consider upgrading — See <a href="${FEATURE_LIFECYCLE_DOC}">Gradle release lifecycle</a></p>`

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
        // Minor distance is the only question here: patch drift inside the grace band is silent.
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

function eolFold(version: GradleVersion): string {
    return `
<details>
    <summary>${SIGN[SupportStatusKind.Eol]} Gradle ${version.version} is end-of-life</summary>
    <p>The ${version.major}.x release line receives no new fixes of any kind. Update to the latest Gradle version.</p>
    <p>Options for staying secure on an end-of-life version: <a href="${SECURITY_SUBSCRIPTION}">Gradle Security Subscription</a></p>
</details>`
}

function render(gradleVersions: string[], releases: ReleaseIndex): string {
    const byKind = classified(gradleVersions, releases)
    const blocks = (byKind.get(SupportStatusKind.Eol) ?? []).map(version => eolFold(version))
    if ([...byKind.keys()].some(kind => kind !== SupportStatusKind.Eol)) {
        blocks.push(UPGRADE_LEGEND)
    }
    return blocks.length > 0 ? `${blocks.join('\n')}\n` : ''
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

/** The status sign shown beside a version in the build-results table, or '' when there is nothing to say. */
export function supportSignOf(gradleVersion: string): string {
    const version = GradleVersion.parse(gradleVersion)
    return version ? SIGN[RELEASES.classify(version)] : ''
}

/** The fold-and-paragraph report placed under the build-results table. */
export function renderSupportStatus(gradleVersions: string[]): string {
    return render(gradleVersions, RELEASES)
}

export function reportSupportStatus(gradleVersions: string[]): void {
    report(gradleVersions, RELEASES)
}

/** Entry points for tests */
export function supportStatusUsing(gradleVersion: string, releasedVersions: string[]): SupportStatusKind {
    const version = GradleVersion.parse(gradleVersion)
    return version ? new ReleaseIndex(releasedVersions).classify(version) : SupportStatusKind.Current
}

export function renderSupportStatusUsing(gradleVersions: string[], releasedVersions: string[]): string {
    return render(gradleVersions, new ReleaseIndex(releasedVersions))
}

export function reportSupportStatusUsing(gradleVersions: string[], releasedVersions: string[]): void {
    report(gradleVersions, new ReleaseIndex(releasedVersions))
}
