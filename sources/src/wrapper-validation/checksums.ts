import * as httpm from 'typed-rest-client/HttpClient'
import * as cheerio from 'cheerio'

import fileWrapperChecksums from './wrapper-checksums.json'

const httpc = new httpm.HttpClient('gradle/wrapper-validation-action', undefined, {allowRetries: true, maxRetries: 3})

export class WrapperChecksums {
    checksums = new Map<string, Set<string>>()
    versions = new Set<string>()

    add(version: string, checksum: string): void {
        if (this.checksums.has(checksum)) {
            this.checksums.get(checksum)!.add(version)
        } else {
            this.checksums.set(checksum, new Set([version]))
        }

        this.versions.add(version)
    }
}

function loadKnownChecksums(): WrapperChecksums {
    const checksums = new WrapperChecksums()
    for (const entry of fileWrapperChecksums) {
        checksums.add(entry.version, entry.checksum)
    }
    return checksums
}

/**
 * Known checksums from previously published Wrapper versions.
 *
 * Maps from the checksum to the names of the Gradle versions whose wrapper has this checksum.
 */
export const KNOWN_CHECKSUMS = loadKnownChecksums()

export async function fetchUnknownChecksums(
    allowSnapshots: boolean,
    knownChecksums: WrapperChecksums
): Promise<Set<string>> {
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
        (entry: any) => !knownChecksums.versions.has(entry.version)
    )
    const checksumUrls = notKnown.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry: any) => entry.wrapperChecksumUrl as string
    )
    if (allowSnapshots) {
        await addDistributionSnapshotChecksums(checksumUrls)
    }
    const checksums = await Promise.all(
        checksumUrls.map(async (url: string) => {
            // console.log(`Fetching checksum from ${url}`)
            return httpGetText(url)
        })
    )
    return new Set(checksums)
}

async function httpGetJsonArray(url: string): Promise<unknown[]> {
    return JSON.parse(await httpGetText(url))
}

async function httpGetText(url: string): Promise<string> {
    const response = await httpc.get(url)
    return await response.readBody()
}

// Public for testing
export async function addDistributionSnapshotChecksums(checksumUrls: string[]): Promise<void> {
    // Load the index page of the distribution snapshot repository
    const indexPage = await httpGetText('https://services.gradle.org/distributions-snapshots/')

    // // Extract all wrapper checksum from the index page. These end in -wrapper.jar.sha256
    // // Load the HTML into cheerio
    const $ = cheerio.load(indexPage)

    // // Find all links ending with '-wrapper.jar.sha256'
    const wrapperChecksumLinks = $('a[href$="-wrapper.jar.sha256"]')

    // build the absolute URL for each wrapper checksum
    wrapperChecksumLinks.each((index, element) => {
        const url = $(element).attr('href')
        checksumUrls.push(`https://services.gradle.org${url}`)
    })
}
