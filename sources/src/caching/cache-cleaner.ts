import * as core from '@actions/core'
import fs from 'fs'
import path from 'path'
import {provisionAndMaybeExecute} from '../execution/gradle'

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

    async forceCleanup(): Promise<void> {
        const cleanTimestamp = core.getState('clean-timestamp')
        await this.forceCleanupFilesOlderThan(cleanTimestamp)
    }

    async forceCleanupFilesOlderThan(cleanTimestamp: string): Promise<void> {
        core.info(`Cleaning up caches before ${cleanTimestamp}`)

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
            
                    releasedWrappers.removeUnusedEntriesOlderThan.set(cleanupTime)
                    snapshotWrappers.removeUnusedEntriesOlderThan.set(cleanupTime)
                    downloadedResources.removeUnusedEntriesOlderThan.set(cleanupTime)
                    createdResources.removeUnusedEntriesOlderThan.set(cleanupTime)
                    buildCache.removeUnusedEntriesOlderThan.set(cleanupTime)
                }
            }
            `
        )
        fs.writeFileSync(path.resolve(cleanupProjectDir, 'build.gradle'), 'task("noop") {}')

        await provisionAndMaybeExecute('current', cleanupProjectDir, [
            '-g',
            this.gradleUserHome,
            '-I',
            'init.gradle',
            '--quiet',
            '--no-daemon',
            '--no-scan',
            '--build-cache',
            '-DGITHUB_DEPENDENCY_GRAPH_ENABLED=false',
            'noop'
        ])
    }
}
