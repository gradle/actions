import * as core from '@actions/core'

import {GradleVersion} from './gradle-version'
import wrapperChecksums from './wrapper-validation/wrapper-checksums.json'

/** Minor lines behind the latest that stay unreported on the current major. */
const MINOR_GRACE = 2

const SECURITY_SUBSCRIPTION = 'https://gradle.org/security-subscription/?utm_source=github-action'
const FEATURE_LIFECYCLE_DOC = 'https://docs.gradle.org/current/userguide/feature_lifecycle.html#eol_support'

enum SupportStatus {
    Current = 'current',
    Behind = 'behind',
    Eol = 'eol'
}

/** The sign shown beside a version in the build-results table; Current has nothing to say. */
const SIGN: Record<SupportStatus, string> = {
    [SupportStatus.Current]: '',
    [SupportStatus.Behind]: ':information_source:',
    [SupportStatus.Eol]: ':warning:'
}

const UPGRADE_LEGEND = `<p>${SIGN[SupportStatus.Behind]} Consider upgrading — See <a href="${FEATURE_LIFECYCLE_DOC}">Gradle release lifecycle</a></p>`

/** Wording shared by the end-of-life annotation and the end-of-life section of the Job Summary. */
const eolHeadline = (version: GradleVersion): string => `Gradle ${version.version} is end-of-life`
const eolDetail = (version: GradleVersion): string =>
    `The ${version.major}.x release line receives no further fixes, security fixes included. ` +
    `Update to the latest Gradle version.`

class ReleaseIndex {
    private readonly latest: GradleVersion

    constructor(releasedVersions: string[]) {
        const finalReleases = releasedVersions
            .map(version => new GradleVersion(version))
            .filter(version => version.isFinalRelease())

        if (finalReleases.length === 0) {
            throw new Error('The Gradle release data contains no final release')
        }

        this.latest = finalReleases.reduce((max, version) => (max.compareTo(version) >= 0 ? max : version))
    }

    private classifyVersion(version: GradleVersion): SupportStatus {
        if (!version.isFinalRelease()) {
            return SupportStatus.Current
        }

        const majorsBehind = this.latest.major - version.major
        if (majorsBehind >= 2) {
            return SupportStatus.Eol
        }
        if (majorsBehind === 1) {
            return SupportStatus.Behind
        }
        if (version.major > this.latest.major) {
            return SupportStatus.Current // newer than the bundled data knows about
        }
        // Same major as the latest release: only the minor distance matters, so a newer patch is never reported.
        return this.latest.minor - version.minor > MINOR_GRACE ? SupportStatus.Behind : SupportStatus.Current
    }

    /** Support status of a single version; an unparseable string is treated as current. */
    classify(gradleVersion: string): SupportStatus {
        const version = GradleVersion.parseUntrusted(gradleVersion)
        return version ? this.classifyVersion(version) : SupportStatus.Current
    }

    /** The flagged versions grouped by status (Current omitted). */
    classified(gradleVersions: string[]): Map<SupportStatus, GradleVersion[]> {
        const byStatus = new Map<SupportStatus, GradleVersion[]>()
        const parsed = [...new Set(gradleVersions)]
            .map(version => GradleVersion.parseUntrusted(version))
            .filter((version): version is GradleVersion => version !== undefined)
            .sort(GradleVersion.compare)

        for (const version of parsed) {
            const status = this.classifyVersion(version)
            if (status !== SupportStatus.Current) {
                byStatus.set(status, [...(byStatus.get(status) ?? []), version])
            }
        }
        return byStatus
    }
}

const RELEASES = new ReleaseIndex(wrapperChecksums.map(entry => entry.version))

/** The status sign shown beside a version in the build-results table, or '' when there is nothing to say. */
export function supportStatusSign(gradleVersion: string): string {
    return SIGN[RELEASES.classify(gradleVersion)]
}

/** Job annotations: a warning for each end-of-life version, a notice for each version merely out of date. */
export function reportSupportStatus(gradleVersions: string[]): void {
    const byStatus = RELEASES.classified(gradleVersions)
    for (const version of byStatus.get(SupportStatus.Eol) ?? []) {
        core.warning(
            `${eolHeadline(version)}. ${eolDetail(version)} If you cannot upgrade, see ${SECURITY_SUBSCRIPTION} for options`,
            {title: 'End-of-life Gradle version'}
        )
    }
    for (const version of byStatus.get(SupportStatus.Behind) ?? []) {
        core.notice(
            `Gradle ${version.version} is out of date: consider updating to the latest Gradle version. See ${FEATURE_LIFECYCLE_DOC}`,
            {title: 'Out-of-date Gradle version'}
        )
    }
}

/** The fold-and-paragraph report placed under the build-results table. */
export function renderSupportStatus(gradleVersions: string[]): string {
    const byStatus = RELEASES.classified(gradleVersions)
    const blocks = (byStatus.get(SupportStatus.Eol) ?? []).map(version => renderEolFold(version))
    if ([...byStatus.keys()].some(status => status !== SupportStatus.Eol)) {
        blocks.push(UPGRADE_LEGEND)
    }
    // The leading blank line closes the preceding HTML block, so each rendering stands on its own.
    return blocks.length > 0 ? `\n${blocks.join('\n')}\n` : ''
}

function renderEolFold(version: GradleVersion): string {
    return `<details>
    <summary>${SIGN[SupportStatus.Eol]} ${eolHeadline(version)}</summary>
    <p>${eolDetail(version)}</p>
    <p>If you cannot upgrade, see the <a href="${SECURITY_SUBSCRIPTION}">Gradle Security Subscription</a> for options.</p>
</details>`
}
