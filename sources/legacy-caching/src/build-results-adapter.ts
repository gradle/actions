import {versionIsAtLeast} from './gradle-utils'

/**
 * Mirrors the BuildResult interface from the main package.
 */
export interface BuildResult {
    get rootProjectName(): string
    get rootProjectDir(): string
    get requestedTasks(): string
    get gradleVersion(): string
    get gradleHomeDir(): string
    get buildFailed(): boolean
    get configCacheHit(): boolean
    get buildScanUri(): string
    get buildScanFailed(): boolean
}

/**
 * Wraps BuildResult[] to provide the helper methods expected by the old caching code.
 */
export class BuildResults {
    results: BuildResult[]

    constructor(results: BuildResult[]) {
        this.results = results
    }

    anyFailed(): boolean {
        return this.results.some(result => result.buildFailed)
    }

    anyConfigCacheHit(): boolean {
        return this.results.some(result => result.configCacheHit)
    }

    uniqueGradleHomes(): string[] {
        const allHomes = this.results.map(buildResult => buildResult.gradleHomeDir)
        return Array.from(new Set(allHomes))
    }

    highestGradleVersion(): string | null {
        if (this.results.length === 0) {
            return null
        }
        return this.results
            .map(result => result.gradleVersion)
            .reduce((maxVersion: string, currentVersion: string) => {
                if (!maxVersion) return currentVersion
                return versionIsAtLeast(currentVersion, maxVersion) ? currentVersion : maxVersion
            })
    }
}
