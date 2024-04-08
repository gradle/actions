import * as fs from 'fs'
import * as path from 'path'

export interface BuildResult {
    get rootProjectName(): string
    get rootProjectDir(): string
    get requestedTasks(): string
    get gradleVersion(): string
    get gradleHomeDir(): string
    get buildFailed(): boolean
    get buildScanUri(): string
    get buildScanFailed(): boolean
}

export function loadBuildResults(): BuildResult[] {
    return getUnprocessedResults().map(filePath => {
        const content = fs.readFileSync(filePath, 'utf8')
        return JSON.parse(content) as BuildResult
    })
}

export function markBuildResultsProcessed(): void {
    getUnprocessedResults().forEach(markProcessed)
}

function getUnprocessedResults(): string[] {
    const buildResultsDir = path.resolve(process.env['RUNNER_TEMP']!, '.build-results')
    if (!fs.existsSync(buildResultsDir)) {
        return []
    }

    return fs
        .readdirSync(buildResultsDir)
        .map(file => {
            return path.resolve(buildResultsDir, file)
        })
        .filter(filePath => {
            return path.extname(filePath) === '.json' && !isProcessed(filePath)
        })
}

function isProcessed(resultFile: string): boolean {
    const markerFile = `${resultFile}.processed`
    return fs.existsSync(markerFile)
}

function markProcessed(resultFile: string): void {
    const markerFile = `${resultFile}.processed`
    fs.writeFileSync(markerFile, '')
}
