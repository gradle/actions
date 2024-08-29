import { versionIsAtLeast } from '../../src/execution/gradle'

describe('gradle-version', () => {
    describe('can compare to', () => {
        it('same version', async () => {
            expect(versionIsAtLeast('6.7.1', '6.7.1')).toBe(true)
            expect(versionIsAtLeast('7.0', '7.0')).toBe(true)
            expect(versionIsAtLeast('7.0', '7.0.0')).toBe(true)
        })
        it('newer version', async () => {
            expect(versionIsAtLeast('6.7.1', '6.7.2')).toBe(false)
            expect(versionIsAtLeast('7.0', '8.0')).toBe(false)
            expect(versionIsAtLeast('7.0', '7.0.1')).toBe(false)
        })
        it('older version', async () => {
            expect(versionIsAtLeast('6.7.2', '6.7.1')).toBe(true)
            expect(versionIsAtLeast('8.0', '7.0')).toBe(true)
            expect(versionIsAtLeast('7.0.1', '7.0')).toBe(true)
        })
        it('rc version', async () => {
            expect(versionIsAtLeast('8.0.2-rc-1', '8.0.1')).toBe(true)
            expect(versionIsAtLeast('8.0.2-rc-1', '8.0.2')).toBe(false)
            expect(versionIsAtLeast('8.1-rc-1', '8.0')).toBe(true)
            expect(versionIsAtLeast('8.0-rc-1', '8.0')).toBe(false)
        })
        it('snapshot version', async () => {
            expect(versionIsAtLeast('8.11-20240829002031+0000', '8.10')).toBe(true)
            expect(versionIsAtLeast('8.11-20240829002031+0000', '8.10.1')).toBe(true)
            expect(versionIsAtLeast('8.11-20240829002031+0000', '8.11')).toBe(false)

            expect(versionIsAtLeast('8.10.2-20240828012138+0000', '8.10')).toBe(true)
            expect(versionIsAtLeast('8.10.2-20240828012138+0000', '8.10.1')).toBe(true)
            expect(versionIsAtLeast('8.10.2-20240828012138+0000', '8.10.2')).toBe(false)
            expect(versionIsAtLeast('8.10.2-20240828012138+0000', '8.11')).toBe(false)

            expect(versionIsAtLeast('9.1-branch-provider_api_migration_public_api_changes-20240826121451+0000', '9.0')).toBe(true)
            expect(versionIsAtLeast('9.1-branch-provider_api_migration_public_api_changes-20240826121451+0000', '9.0.1')).toBe(true)
            expect(versionIsAtLeast('9.1-branch-provider_api_migration_public_api_changes-20240826121451+0000', '9.1')).toBe(false)
        })
    })
})
