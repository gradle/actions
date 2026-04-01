import * as core from '@actions/core'
import * as exec from '@actions/exec'

import fs from 'fs'
import path from 'path'
import {BuildResults} from './build-results-adapter'
import {versionIsAtLeast, provisionGradleWithVersionAtLeast} from './gradle-utils'

const MINIMUM_CLEANUP_GRADLE_VERSION = '8.11'

export class CacheCleaner {
    private readonly gradleUserHome: string
    private readonly tmpDir: string

    constructor(gradleUserHome: string, tmpDir: string) {
        this.gradleUserHome = gradleUserHome
        this.tmpDir = tmpDir
    }

    async prepare(): Promise<string> {
        // Save the current timestamp
        const timestamp = Date.now().toString()
        core.saveState('clean-timestamp', timestamp)
        return timestamp
    }

    async forceCleanup(buildResults: BuildResults): Promise<void> {
        const executable = await this.gradleExecutableForCleanup(buildResults)
        const cleanTimestamp = core.getState('clean-timestamp')
        await this.forceCleanupFilesOlderThan(cleanTimestamp, executable)
    }

    /**
     * Attempt to use the newest Gradle version that was used to run a build, at least 8.11.
     *
     * This will avoid the need to provision a Gradle version for the cleanup when not necessary.
     */
    private async gradleExecutableForCleanup(buildResults: BuildResults): Promise<string> {
        const highestVersion = buildResults.highestGradleVersion()
        const version =
            highestVersion && versionIsAtLeast(highestVersion, MINIMUM_CLEANUP_GRADLE_VERSION)
                ? highestVersion
                : MINIMUM_CLEANUP_GRADLE_VERSION
        return await provisionGradleWithVersionAtLeast(version)
    }

    // Visible for testing
    async forceCleanupFilesOlderThan(cleanTimestamp: string, executable: string): Promise<void> {
        // Run a dummy Gradle build to trigger cache cleanup
        const cleanupProjectDir = path.resolve(this.tmpDir, 'dummy-cleanup-project')
        fs.mkdirSync(cleanupProjectDir, {recursive: true})
        fs.writeFileSync(
            path.resolve(cleanupProjectDir, 'settings.gradle'),
            'rootProject.name = "dummy-cleanup-project"'
        )
        fs.writeFileSync(
            path.resolve(cleanupProjectDir, 'init.gradle'),
            `
            beforeSettings { settings ->
                def cleanupTime = ${cleanTimestamp}
            
                settings.caches {
                    cleanup = Cleanup.ALWAYS
            
                    releasedWrappers.setRemoveUnusedEntriesOlderThan(cleanupTime)
                    snapshotWrappers.setRemoveUnusedEntriesOlderThan(cleanupTime)
                    downloadedResources.setRemoveUnusedEntriesOlderThan(cleanupTime)
                    createdResources.setRemoveUnusedEntriesOlderThan(cleanupTime)
                    buildCache.setRemoveUnusedEntriesOlderThan(cleanupTime)
                }
            }
            `
        )
        fs.writeFileSync(path.resolve(cleanupProjectDir, 'build.gradle'), 'task("noop") {}')

        await core.group('Executing Gradle to clean up caches', async () => {
            core.info(`Cleaning up caches last used before ${cleanTimestamp}`)
            await this.executeCleanupBuild(executable, cleanupProjectDir)
        })
    }

    private async executeCleanupBuild(executable: string, cleanupProjectDir: string): Promise<void> {
        const args = [
            '-g',
            this.gradleUserHome,
            '-I',
            'init.gradle',
            '--info',
            '--no-daemon',
            '--no-scan',
            '--build-cache',
            '-DGITHUB_DEPENDENCY_GRAPH_ENABLED=false',
            '-DGRADLE_ACTIONS_SKIP_BUILD_RESULT_CAPTURE=true',
            'noop'
        ]

        await exec.exec(executable, args, {
            cwd: cleanupProjectDir
        })
    }
}
