import * as httpm from 'typed-rest-client/HttpClient'

import fileWrapperChecksums from './wrapper-checksums.json'

const httpc = new httpm.HttpClient('gradle/wrapper-validation-action', undefined, {allowRetries: true, maxRetries: 3})

function getKnownValidChecksums(): Map<string, Set<string>> {
    const versionsMap = new Map<string, Set<string>>()
    for (const entry of fileWrapperChecksums) {
        const checksum = entry.checksum

        let versionNames = versionsMap.get(checksum)
        if (versionNames === undefined) {
            versionNames = new Set()
            versionsMap.set(checksum, versionNames)
        }

        versionNames.add(entry.version)
    }

    return versionsMap
}

/**
 * Known checksums from previously published Wrapper versions.
 *
 * Maps from the checksum to the names of the Gradle versions whose wrapper has this checksum.
 */
export const KNOWN_VALID_CHECKSUMS = getKnownValidChecksums()

export async function fetchValidChecksums(allowSnapshots: boolean): Promise<Set<string>> {
    const all = await httpGetJsonArray('https://services.gradle.org/versions/all')
    const withChecksum = all.filter(
        entry => typeof entry === 'object' && entry != null && entry.hasOwnProperty('wrapperChecksumUrl')
    )
    const allowed = withChecksum.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry: any) => allowSnapshots || !entry.snapshot
    )
    const checksumUrls = allowed.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry: any) => entry.wrapperChecksumUrl as string
    )
    const checksums = await Promise.all(checksumUrls.map(async (url: string) => httpGetText(url)))
    return new Set(checksums)
}

async function httpGetJsonArray(url: string): Promise<unknown[]> {
    return JSON.parse(await httpGetText(url))
}

async function httpGetText(url: string): Promise<string> {
    const response = await httpc.get(url)
    return await response.readBody()
}
