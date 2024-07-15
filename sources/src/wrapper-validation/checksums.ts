import * as httpm from 'typed-rest-client/HttpClient'

import fileWrapperChecksums from './wrapper-checksums.json'

const httpc = new httpm.HttpClient('gradle/wrapper-validation-action', undefined, {allowRetries: true, maxRetries: 3})

/**
 * Known checksums from previously published Wrapper versions.
 *
 * Maps from the checksum to the names of the Gradle versions whose wrapper has this checksum.
 */
export const KNOWN_CHECKSUMS = loadKnownChecksums()

function loadKnownChecksums(): WrapperChecksums {
    const checksums = new WrapperChecksums()
    for (const entry of fileWrapperChecksums) {
        checksums.add(entry.version, entry.checksum)
    }
    return checksums
}

export async function fetchUnknownChecksums(allowSnapshots: boolean): Promise<Set<string>> {
    const all = await httpGetJsonArray('https://services.gradle.org/versions/all')
    const withChecksum = all.filter(
        entry => typeof entry === 'object' && entry != null && entry.hasOwnProperty('wrapperChecksumUrl')
    )
    const allowed = withChecksum.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry: any) => allowSnapshots || !entry.snapshot
    )
    const notKnown = allowed.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry: any) => !KNOWN_CHECKSUMS.versions.has(entry.version)
    )
    const checksumUrls = notKnown.map(
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

export class WrapperChecksums {
    checksums = new Set<string>()
    versions = new Set<string>()

    add(version: string, checksum: string): void {
        this.versions.add(version)
        this.checksums.add(checksum)
    }
}
