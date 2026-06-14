import {describe, expect, it} from '@jest/globals'

import {CacheReport} from '../../src/cache-service'
import {renderCachingReport} from '../../src/caching-report'

const ENHANCED = {kind: 'enhanced'} as const
const BASIC = {kind: 'basic'} as const

function entry(overrides: Partial<CacheReport['entries'][number]> = {}): CacheReport['entries'][number] {
    return {
        entryName: 'Gradle User Home',
        requestedKey: 'gradle-home-v1|key',
        restoredKey: 'gradle-home-v1|key',
        restoredSize: 535792,
        restoredTime: 253,
        restoredOutcome: '(Entry restored: exact match found)',
        savedKey: 'gradle-home-v1|key',
        savedSize: 528509,
        savedTime: 257,
        savedOutcome: '(Entry saved)',
        ...overrides
    }
}

describe('renderCachingReport', () => {
    it('renders an enhanced read-only report with heading, note and details', () => {
        const report: CacheReport = {status: 'read-only', cleanup: 'disabled-readonly', entries: [entry()]}
        const md = renderCachingReport(report, ENHANCED)

        expect(md).toContain('<h4>Gradle State Caching - ⚡ Enhanced (read-only)</h4>')
        expect(md).toContain('[Enhanced Caching]')
        expect(md).toContain('`gradle-actions-caching`')
        expect(md).toContain('DISTRIBUTION.md')
        expect(md).toContain('<details>')
        expect(md).toContain('<summary>Entries: 1 restored (1Mb), 1 saved (1Mb) - Expand for more details</summary>')
        // status message moves inside the details expando
        expect(md).toContain('Cache was read-only')
        // read-only does not render the cleanup line
        expect(md).not.toContain('Cache cleanup')
    })

    it('renders an enhanced enabled report with status and cleanup inside the details', () => {
        const report: CacheReport = {status: 'enabled', cleanup: 'enabled', entries: [entry()]}
        const md = renderCachingReport(report, ENHANCED)

        expect(md).toContain('<h4>Gradle State Caching - ⚡ Enhanced</h4>')
        // status and cleanup messages are within the expando, after the summary
        const detailsBody = md.slice(md.indexOf('</summary>'))
        expect(detailsBody).toContain('Cache was enabled')
        expect(detailsBody).toContain('Cache cleanup')
        expect(md).toContain('<table>')
        expect(md).toContain('Entries Restored')
    })

    it('renders a basic report with the upgrade note and no metrics table', () => {
        const report: CacheReport = {
            status: 'read-only',
            entries: [
                entry({
                    restoredSize: undefined,
                    restoredTime: undefined,
                    savedKey: undefined,
                    savedSize: undefined,
                    savedTime: undefined,
                    savedOutcome: '(Entry not saved: cache is read-only)'
                })
            ]
        }
        const md = renderCachingReport(report, BASIC)

        expect(md).toContain('<h4>Gradle State Caching - 🛡️ Basic (read-only)</h4>')
        expect(md).toContain('[Basic Caching]')
        expect(md).toContain('[Enhanced Caching]')
        // DISTRIBUTION.md is only referenced for the enhanced provider
        expect(md).not.toContain('DISTRIBUTION.md')
        // No size/time data, so the metrics table is omitted but the entry list remains
        expect(md).not.toContain('<table>')
        expect(md).toContain('<pre>')
        expect(md).toContain('<summary>Entries: 1 restored, 0 saved - Expand for more details</summary>')
    })

    it('renders the project-cache status line inside the details', () => {
        const report: CacheReport = {
            status: 'enabled',
            cleanup: 'enabled',
            projectCache: 'enabled',
            entries: [entry()]
        }
        const md = renderCachingReport(report, ENHANCED)

        const detailsBody = md.slice(md.indexOf('</summary>'))
        expect(detailsBody).toContain(
            'Caching of project state (build-logic and configuration cache) was enabled.'
        )
    })

    it('renders nothing for the not-enabled project-cache status', () => {
        const report: CacheReport = {
            status: 'enabled',
            cleanup: 'enabled',
            projectCache: 'not-enabled',
            entries: [entry()]
        }
        const md = renderCachingReport(report, ENHANCED)

        expect(md).not.toContain('Project state')
        expect(md).not.toContain('build-logic')
    })

    it('omits the project-cache line when the status is absent', () => {
        const report: CacheReport = {status: 'enabled', cleanup: 'enabled', entries: [entry()]}
        const md = renderCachingReport(report, ENHANCED)

        expect(md).not.toContain('Project state')
    })

    it('renders a compact disabled report with no note and no details', () => {
        const report: CacheReport = {status: 'disabled', entries: []}
        const md = renderCachingReport(report, undefined)

        expect(md).toContain('<h4>Gradle State Caching - Disabled</h4>')
        expect(md).toContain('Caching was disabled')
        expect(md).not.toContain('<details>')
        expect(md).not.toContain('DISTRIBUTION.md')
    })

    it('renders a compact skipped report for a pre-existing Gradle User Home', () => {
        const report: CacheReport = {status: 'disabled-existing-home', entries: []}
        const md = renderCachingReport(report, ENHANCED)

        expect(md).toContain('<h4>Gradle State Caching - Skipped</h4>')
        expect(md).toContain('pre-existing Gradle User Home')
        expect(md).not.toContain('<details>')
        // no provider note for non-active states
        expect(md).not.toContain('DISTRIBUTION.md')
    })

    it('renders an unavailable report compactly', () => {
        const report: CacheReport = {status: 'not-available', entries: []}
        const md = renderCachingReport(report, ENHANCED)

        expect(md).toContain('<h4>Gradle State Caching - Unavailable</h4>')
        expect(md).not.toContain('<details>')
    })
})
