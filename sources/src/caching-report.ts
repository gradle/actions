import {CacheCleanupStatus, CacheEntryReport, CacheReport, CacheStatus} from './cache-service'

const DOCS = 'https://github.com/gradle/actions/blob/main/docs/setup-gradle.md'
const DISTRIBUTION = 'https://github.com/gradle/actions/blob/main/DISTRIBUTION.md'

/**
 * Identifies the caching provider in use, so the report can attribute the cache
 * and surface the relevant terms-of-use / upgrade information.
 */
export interface ProviderNote {
    kind: 'enhanced' | 'basic'
}

const STATUS_COPY: Record<CacheStatus, string> = {
    enabled: `[Cache was enabled](${DOCS}#caching-build-state-between-jobs) — Gradle User Home was restored from the cache and saved for use by subsequent jobs.`,
    'read-only': `[Cache was read-only](${DOCS}#using-the-cache-read-only) — by default, the action only writes to the cache for jobs running on the default branch.`,
    'write-only': `[Cache was write-only](${DOCS}#using-the-cache-write-only) — Gradle User Home was not restored from the cache.`,
    disabled: `[Caching was disabled](${DOCS}#disabling-caching) — Gradle User Home was not restored from or saved to the cache.`,
    'disabled-existing-home': `⚠️ [Caching was skipped](${DOCS}#overwriting-an-existing-gradle-user-home) — a pre-existing Gradle User Home was found, so the cache was not restored or saved.`,
    'not-available': `Caching is not available — the GitHub Actions cache service could not be reached, so Gradle User Home was not restored or saved.`
}

const CLEANUP_COPY: Record<CacheCleanupStatus, string> = {
    enabled: `[Cache cleanup](${DOCS}#configuring-cache-cleanup) purged stale files from Gradle User Home before saving.`,
    'disabled-param': `[Cache cleanup](${DOCS}#configuring-cache-cleanup) was disabled via action parameter.`,
    'disabled-failure': `[Cache cleanup](${DOCS}#configuring-cache-cleanup) was skipped due to a build failure. Use \`cache-cleanup: always\` to override.`,
    'disabled-config-cache-hit': `[Cache cleanup](${DOCS}#configuring-cache-cleanup) was skipped due to configuration-cache reuse.`,
    'disabled-readonly': `[Cache cleanup](${DOCS}#configuring-cache-cleanup) is always disabled when the cache is read-only.`
}

/**
 * Renders a cache report into the unified Job Summary markdown, with a consistent
 * skeleton across every variant: a section heading, a status line, an integrated
 * provider note, and (when there are entries) an expandable details section.
 */
export function renderCachingReport(report: CacheReport, providerNote?: ProviderNote): string {
    if (!isActive(report.status)) {
        // Disabled / skipped / unavailable: a compact heading + status line, no expandable section.
        return `${renderHeading(report.status, providerNote)}\n\n${STATUS_COPY[report.status]}\n`
    }
    const sections = [
        renderHeading(report.status, providerNote),
        renderProviderNote(providerNote),
        // Status and cleanup messages live inside the details expando; if there are no entries
        // to expand, fall back to showing the status line directly.
        report.entries.length > 0 ? renderDetails(report) : STATUS_COPY[report.status]
    ]
    return `${sections.filter(section => section !== undefined && section !== '').join('\n\n')}\n`
}

function isActive(status: CacheStatus): boolean {
    return status === 'enabled' || status === 'read-only' || status === 'write-only'
}

function renderHeading(status: CacheStatus, providerNote?: ProviderNote): string {
    if (!isActive(status)) {
        const label =
            status === 'disabled-existing-home' ? 'Skipped' : status === 'not-available' ? 'Unavailable' : 'Disabled'
        return `<h4>Gradle Caching — ${label}</h4>`
    }

    const icon = providerNote?.kind === 'basic' ? '🛡️ ' : providerNote?.kind === 'enhanced' ? '⚡ ' : ''
    const provider =
        providerNote?.kind === 'basic'
            ? ' — Basic Provider'
            : providerNote?.kind === 'enhanced'
              ? ' — Enhanced Provider'
              : ''
    return `<h4>${icon}Gradle Caching${provider}</h4>`
}

function renderCleanupLine(cleanup?: CacheCleanupStatus): string | undefined {
    return cleanup ? CLEANUP_COPY[cleanup] : undefined
}

function renderProviderNote(providerNote?: ProviderNote): string | undefined {
    if (!providerNote) {
        return undefined
    }
    if (providerNote.kind === 'enhanced') {
        return `**[Enhanced Caching](${DOCS}#enhanced-caching)** is provided by the proprietary \`gradle-actions-caching\` provider. See [DISTRIBUTION.md](${DISTRIBUTION}) for terms of use and opt-out instructions.`
    }
    return `**[Basic Caching](${DOCS}#basic-caching)** uses the basic open-source provider. For faster builds and advanced features, consider the **[Enhanced Caching](${DOCS}#enhanced-caching)** provider. See [DISTRIBUTION.md](${DISTRIBUTION}) for details.`
}

function renderDetails(report: CacheReport): string {
    const restored = report.entries.filter(entry => entry.restoredKey).length
    const saved = report.entries.filter(entry => entry.savedKey).length
    const summary = `Entries: ${restored} restored, ${saved} saved (expand for more details)`

    const cleanup = report.status === 'enabled' ? renderCleanupLine(report.cleanup) : undefined
    const table = renderEntryTable(report.entries)
    const pre = `<pre>\n${renderEntryDetails(report.entries)}</pre>`
    const body = [STATUS_COPY[report.status], cleanup, table, pre].filter(Boolean).join('\n\n')

    return `<details>
<summary>${summary}</summary>

${body}
</details>`
}

function renderEntryTable(entries: CacheEntryReport[]): string {
    const hasMetrics = entries.some(
        entry => entry.restoredSize || entry.restoredTime || entry.savedSize || entry.savedTime
    )
    if (!hasMetrics) {
        return ''
    }
    return `<table>
    <tr><td></td><th>Count</th><th>Total Size (Mb)</th><th>Total Time (ms)</th></tr>
    <tr><td>Entries Restored</td>
        <td>${getCount(entries, e => e.restoredSize)}</td>
        <td>${getSize(entries, e => e.restoredSize)}</td>
        <td>${getTime(entries, e => e.restoredTime)}</td>
    </tr>
    <tr><td>Entries Saved</td>
        <td>${getCount(entries, e => e.savedSize)}</td>
        <td>${getSize(entries, e => e.savedSize)}</td>
        <td>${getTime(entries, e => e.savedTime)}</td>
    </tr>
</table>`
}

function renderEntryDetails(entries: CacheEntryReport[]): string {
    return entries
        .map(
            entry => `Entry: ${entry.entryName}
    Requested Key : ${entry.requestedKey ?? ''}
    Restored  Key : ${entry.restoredKey ?? ''}
              Size: ${formatSize(entry.restoredSize)}
              Time: ${formatTime(entry.restoredTime)}
              ${entry.restoredOutcome}
    Saved     Key : ${entry.savedKey ?? ''}
              Size: ${formatSize(entry.savedSize)}
              Time: ${formatTime(entry.savedTime)}
              ${entry.savedOutcome}
`
        )
        .join('---\n')
}

function getCount(entries: CacheEntryReport[], predicate: (value: CacheEntryReport) => number | undefined): number {
    return entries.filter(e => predicate(e)).length
}

function getSize(entries: CacheEntryReport[], predicate: (value: CacheEntryReport) => number | undefined): number {
    const bytes = entries.map(e => predicate(e) ?? 0).reduce((p, v) => p + v, 0)
    return Math.round(bytes / (1024 * 1024))
}

function getTime(entries: CacheEntryReport[], predicate: (value: CacheEntryReport) => number | undefined): number {
    return entries.map(e => predicate(e) ?? 0).reduce((p, v) => p + v, 0)
}

function formatSize(bytes: number | undefined): string {
    if (bytes === undefined || bytes === 0) {
        return ''
    }
    return `${Math.round(bytes / (1024 * 1024))} MB (${bytes} B)`
}

function formatTime(ms: number | undefined): string {
    if (ms === undefined || ms === 0) {
        return ''
    }
    return `${ms} ms`
}
