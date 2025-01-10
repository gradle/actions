import {describe, expect, it} from '@jest/globals'

import {versionIsAtLeast, parseGradleVersionFromOutput} from '../../src/execution/gradle'

describe('gradle', () => {
    describe('can compare version with', () => {
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
    describe('can parse version from output', () => {
        it('major version', async () => {
            const output = `
    ------------------------------------------------------------
    Gradle 8.9
    ------------------------------------------------------------
    `
            const version = await parseGradleVersionFromOutput(output)!
            expect(version).toBe('8.9')
        })
    
        it('patch version', async () => {
            const output = `
    ------------------------------------------------------------
    Gradle 8.9.1
    ------------------------------------------------------------
    `
            const version = await parseGradleVersionFromOutput(output)!
            expect(version).toBe('8.9.1')
        })
    
        it('rc version', async () => {
            const output = `
    ------------------------------------------------------------
    Gradle 8.9-rc-1
    ------------------------------------------------------------
    `
            const version = await parseGradleVersionFromOutput(output)!
            expect(version).toBe('8.9-rc-1')
        })
    
        it('milestone version', async () => {
            const output = `
    ------------------------------------------------------------
    Gradle 8.0-milestone-6
    ------------------------------------------------------------
    `
            const version = await parseGradleVersionFromOutput(output)!
            expect(version).toBe('8.0-milestone-6')
        })
    
        it('snapshot version', async () => {
            const output = `
    ------------------------------------------------------------
    Gradle 8.10.2-20240828012138+0000
    ------------------------------------------------------------
    `
            const version = await parseGradleVersionFromOutput(output)!
            expect(version).toBe('8.10.2-20240828012138+0000')
        })
    
        it('branch version', async () => {
            const output = `
    ------------------------------------------------------------
    Gradle 9.0-branch-provider_api_migration_public_api_changes-20240830060514+0000
    ------------------------------------------------------------
    `
            const version = await parseGradleVersionFromOutput(output)!
            expect(version).toBe('9.0-branch-provider_api_migration_public_api_changes-20240830060514+0000')
        })
    })
})

