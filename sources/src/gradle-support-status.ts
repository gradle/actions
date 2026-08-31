import * as core from '@actions/core'

import {GradleVersion} from './execution/gradle-version'
import wrapperChecksums from './wrapper-validation/wrapper-checksums.json'

/** Minor lines behind the latest that stay unreported on the current major. */
const MINOR_GRACE = 2

const SECURITY_SUBSCRIPTION =
    'https://fantastic-bassoon-z4jm99l.pages.github.io/dotorg-site/pull/1172/security-subscription/'
const FEATURE_LIFECYCLE_DOC = 'https://docs.gradle.org/current/userguide/feature_lifecycle.html#eol_support'

export enum SupportStatusKind {
    Current = 'current',
    Behind = 'behind',
    Maintenance = 'maintenance',
    Unpatched = 'unpatched',
    Unmaintained = 'unmaintained',
    Eol = 'eol'
}

const SIGN: Record<SupportStatusKind, string> = {
    [SupportStatusKind.Current]: '',
    [SupportStatusKind.Behind]: ':information_source:',
    [SupportStatusKind.Maintenance]: ':information_source:',
    [SupportStatusKind.Unpatched]: ':warning:',
    [SupportStatusKind.Unmaintained]: ':warning:',
    [SupportStatusKind.Eol]: ':octagonal_sign:'
}

const WARN_KINDS = [SupportStatusKind.Unmaintained, SupportStatusKind.Unpatched]
const INFO_KINDS = [SupportStatusKind.Maintenance, SupportStatusKind.Behind]

class ReleaseIndex {
    readonly latestMajor: number
    private readonly latest: GradleVersion | undefined
    private readonly latestByMajor = new Map<number, GradleVersion>()
    private readonly latestByLine = new Map<string, GradleVersion>()

    constructor(releasedVersions: string[]) {
        const finals = releasedVersions
            .map(version => GradleVersion.parse(version))
            .filter((version): version is GradleVersion => version !== undefined && version.isFinalRelease())
            .sort(GradleVersion.compare)

        // Ascending, so the last write per key wins.
        for (const version of finals) {
            this.latestByMajor.set(version.major, version)
            this.latestByLine.set(version.line, version)
        }
        this.latest = finals[finals.length - 1]
        this.latestMajor = this.latest?.major ?? 0
    }

    get knownLatest(): string | undefined {
        return this.latest?.version
    }

    latestOfMajor(major: number): string | undefined {
        return this.latestByMajor.get(major)?.version
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
            if (version.minor !== this.latestMinorOf(version.major)) {
                return SupportStatusKind.Unmaintained
            }
            const lineLatest = this.latestByLine.get(version.line)
            return lineLatest !== undefined && lineLatest.patch > version.patch
                ? SupportStatusKind.Unpatched
                : SupportStatusKind.Maintenance
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

function list(versions: GradleVersion[]): string {
    return versions.map(version => version.version).join(', ')
}

function eolFold(version: GradleVersion, knownLatest: string): string {
    return `
<details>
    <summary>${SIGN[SupportStatusKind.Eol]} Gradle ${version.version} is end-of-life</summary>
    <p>The ${version.major}.x release line receives no new fixes of any kind. Update to at least Gradle <strong>${knownLatest}</strong>.</p>
    <p>Options for staying secure on an end-of-life version: <a href="${SECURITY_SUBSCRIPTION}">Gradle security subscription</a></p>
</details>`
}

function labelLink(text: string): string {
    return `<a href="${FEATURE_LIFECYCLE_DOC}">${text}</a>`
}

function warnEntry(
    versions: GradleVersion[],
    onlyKind: SupportStatusKind | undefined,
    knownLatest: string,
    lastMinorPatch: string
): string {
    // Grouped entries always read 'Unmaintained': the likelier case once versions collapse.
    const label = labelLink(onlyKind === SupportStatusKind.Unpatched ? 'Unpatched' : 'Unmaintained')
    return `<p>${SIGN[SupportStatusKind.Unmaintained]} <strong>${list(versions)}</strong> ${label} — update Gradle to at least <strong>${knownLatest}</strong>, or at least <strong>${lastMinorPatch}</strong></p>`
}

function infoEntry(versions: GradleVersion[], onlyKind: SupportStatusKind | undefined, knownLatest: string): string {
    const sign = SIGN[SupportStatusKind.Behind]
    if (onlyKind === SupportStatusKind.Maintenance) {
        return `<p>${sign} <strong>${list(versions)}</strong> ${labelLink('Maintenance only')} — Update Gradle to at least <strong>${knownLatest}</strong></p>`
    }
    return `<p>${sign} <strong>${list(versions)}</strong> ${labelLink('Out of date')} — update Gradle to at least <strong>${knownLatest}</strong></p>`
}

function collect(
    byKind: Map<SupportStatusKind, GradleVersion[]>,
    kinds: SupportStatusKind[]
): {versions: GradleVersion[]; onlyKind: SupportStatusKind | undefined} {
    const present = kinds.filter(kind => (byKind.get(kind) ?? []).length > 0)
    const versions = present.flatMap(kind => byKind.get(kind) ?? []).sort(GradleVersion.compare)
    return {versions, onlyKind: versions.length === 1 ? present[0] : undefined}
}

function render(gradleVersions: string[], releases: ReleaseIndex): string {
    const knownLatest = releases.knownLatest
    if (knownLatest === undefined) {
        return ''
    }

    const byKind = classified(gradleVersions, releases)
    const blocks = (byKind.get(SupportStatusKind.Eol) ?? []).map(version => eolFold(version, knownLatest))

    const warn = collect(byKind, WARN_KINDS)
    if (warn.versions.length > 0) {
        const major = warn.versions[0].major
        blocks.push(warnEntry(warn.versions, warn.onlyKind, knownLatest, releases.latestOfMajor(major) ?? knownLatest))
    }

    const info = collect(byKind, INFO_KINDS)
    if (info.versions.length > 0) {
        blocks.push(infoEntry(info.versions, info.onlyKind, knownLatest))
    }

    return blocks.length > 0 ? `${blocks.join('\n')}\n` : ''
}

function report(gradleVersions: string[], releases: ReleaseIndex): void {
    const knownLatest = releases.knownLatest
    if (knownLatest === undefined) {
        return
    }

    const byKind = classified(gradleVersions, releases)
    for (const version of byKind.get(SupportStatusKind.Eol) ?? []) {
        core.warning(
            `Gradle ${version.version} is end-of-life: the ${version.major}.x release line receives no new fixes of any kind, including security fixes. Update to at least Gradle ${knownLatest}. See ${FEATURE_LIFECYCLE_DOC}`,
            {title: 'Gradle version at end-of-life'}
        )
    }
    for (const kind of WARN_KINDS) {
        for (const version of byKind.get(kind) ?? []) {
            const lastMinorPatch = releases.latestOfMajor(version.major) ?? knownLatest
            core.warning(
                `Gradle ${version.version} is not the maintained ${version.major}.x line and receives no fixes. Update to at least Gradle ${knownLatest}, or at least ${lastMinorPatch} to stay on ${version.major}.x. See ${FEATURE_LIFECYCLE_DOC}`,
                {title: 'Gradle version missing fixes'}
            )
        }
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
