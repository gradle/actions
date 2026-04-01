import * as core from '@actions/core'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as semver from 'semver'
import * as httpm from '@actions/http-client'
import * as toolCache from '@actions/tool-cache'

import which from 'which'

const IS_WINDOWS = process.platform === 'win32'
const gradleVersionsBaseUrl = 'https://services.gradle.org/versions'

class GradleVersion {
    static PATTERN = /((\d+)(\.\d+)+)(-([a-z]+)-(\w+))?(-(SNAPSHOT|\d{14}([-+]\d{4})?))?/

    versionPart: string
    stagePart: string
    snapshotPart: string

    constructor(readonly version: string) {
        const matcher = GradleVersion.PATTERN.exec(version)
        if (!matcher) {
            throw new Error(`'${version}' is not a valid Gradle version string (examples: '1.0', '1.0-rc-1')`)
        }

        this.versionPart = matcher[1]
        this.stagePart = matcher[4]
        this.snapshotPart = matcher[7]
    }
}

export function versionIsAtLeast(actualVersion: string, requiredVersion: string): boolean {
    if (actualVersion === requiredVersion) {
        return true
    }

    const actual = new GradleVersion(actualVersion)
    const required = new GradleVersion(requiredVersion)

    const actualSemver = semver.coerce(actual.versionPart)!
    const comparisonSemver = semver.coerce(required.versionPart)!

    if (semver.gt(actualSemver, comparisonSemver)) {
        return true
    }
    if (semver.lt(actualSemver, comparisonSemver)) {
        return false
    }

    if (actual.snapshotPart || required.snapshotPart) {
        if (actual.snapshotPart && !required.snapshotPart && !required.stagePart) {
            return false
        }
        if (required.snapshotPart && !actual.snapshotPart && !actual.stagePart) {
            return true
        }
        return false
    }

    if (actual.stagePart) {
        if (required.stagePart) {
            return actual.stagePart >= required.stagePart
        }
        return false
    }

    return true
}

function installScriptFilename(): string {
    return IS_WINDOWS ? 'gradle.bat' : 'gradle'
}

async function findGradleExecutableOnPath(): Promise<string | null> {
    return await which('gradle', {nothrow: true})
}

async function determineGradleVersion(gradleExecutable: string): Promise<string | undefined> {
    const {exec} = await import('@actions/exec')
    const output = await (await import('@actions/exec')).getExecOutput(gradleExecutable, ['-v'], {silent: true})
    const regex = /Gradle (\d+\.\d+(\.\d+)?(-.*)?)/
    return output.stdout.match(regex)?.[1]
}

interface GradleVersionInfo {
    version: string
    downloadUrl: string
}

/**
 * Find (or install) a Gradle executable that meets the specified version requirement.
 * Checks Gradle on PATH and any candidates first, then downloads if needed.
 */
export async function provisionGradleWithVersionAtLeast(
    minimumVersion: string,
    candidates: string[] = []
): Promise<string> {
    const gradleOnPath = await findGradleExecutableOnPath()
    const allCandidates = gradleOnPath ? [gradleOnPath, ...candidates] : candidates

    return core.group(`Provision Gradle >= ${minimumVersion}`, async () => {
        for (const candidate of allCandidates) {
            const candidateVersion = await determineGradleVersion(candidate)
            if (candidateVersion && versionIsAtLeast(candidateVersion, minimumVersion)) {
                core.info(
                    `Gradle version ${candidateVersion} is available at ${candidate} and >= ${minimumVersion}. Not installing.`
                )
                return candidate
            }
        }

        return locateGradleAndDownloadIfRequired(await gradleRelease(minimumVersion))
    })
}

async function gradleRelease(version: string): Promise<GradleVersionInfo> {
    const allVersions: GradleVersionInfo[] = JSON.parse(
        await httpGetString(`${gradleVersionsBaseUrl}/all`)
    )
    const versionInfo = allVersions.find(entry => entry.version === version)
    if (!versionInfo) {
        throw new Error(`Gradle version ${version} does not exist`)
    }
    return versionInfo
}

async function locateGradleAndDownloadIfRequired(versionInfo: GradleVersionInfo): Promise<string> {
    const installsDir = path.join(getProvisionDir(), 'installs')
    const installDir = path.join(installsDir, `gradle-${versionInfo.version}`)
    if (fs.existsSync(installDir)) {
        core.info(`Gradle installation already exists at ${installDir}`)
        return executableFrom(installDir)
    }

    const downloadPath = path.join(getProvisionDir(), `downloads/gradle-${versionInfo.version}-bin.zip`)
    await toolCache.downloadTool(versionInfo.downloadUrl, downloadPath)
    core.info(`Downloaded ${versionInfo.downloadUrl} to ${downloadPath} (size ${fs.statSync(downloadPath).size})`)

    await toolCache.extractZip(downloadPath, installsDir)
    core.info(`Extracted Gradle ${versionInfo.version} to ${installDir}`)

    const executable = executableFrom(installDir)
    fs.chmodSync(executable, '755')
    core.info(`Provisioned Gradle executable ${executable}`)

    return executable
}

function getProvisionDir(): string {
    const tmpDir = process.env['RUNNER_TEMP'] ?? os.tmpdir()
    return path.join(tmpDir, '.gradle-actions/gradle-installations')
}

function executableFrom(installDir: string): string {
    return path.join(installDir, 'bin', installScriptFilename())
}

async function httpGetString(url: string): Promise<string> {
    const httpClient = new httpm.HttpClient('gradle/actions')
    const response = await httpClient.get(url)
    return response.readBody()
}
