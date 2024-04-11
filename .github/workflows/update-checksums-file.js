/*
 * Updates the `wrapper-checksums.json` file
 *
 * This is intended to be executed by the GitHub workflow, but can also be run
 * manually.
 */

// @ts-check

const httpm = require('typed-rest-client/HttpClient')

const path = require('path')
const fs = require('fs')

/**
 * @returns {Promise<void>}
 */
async function main() {
  const httpc = new httpm.HttpClient(
    'gradle/wrapper-validation-action/update-checksums-workflow',
    undefined,
    {allowRetries: true, maxRetries: 3}
  )

  /**
   * @param {string} url
   * @returns {Promise<string>}
   */
  async function httpGetText(url) {
    const response = await httpc.get(url)
    return await response.readBody()
  }

  /**
   * @typedef {Object} ApiVersionEntry
   * @property {string} version - version name
   * @property {string=} wrapperChecksumUrl - wrapper checksum URL; not present for old versions
   * @property {boolean} snapshot - whether this is a snapshot version
   */

  /**
   * @returns {Promise<ApiVersionEntry[]>}
   */
  async function httpGetVersions() {
    return JSON.parse(
      await httpGetText('https://services.gradle.org/versions/all')
    )
  }

  const versions = (await httpGetVersions())
    // Only include versions with checksum
    .filter(e => e.wrapperChecksumUrl !== undefined)
    // Ignore snapshots; they are changing frequently so no point in including them in checksums file
    .filter(e => !e.snapshot)
  console.info(`Got ${versions.length} relevant Gradle versions`)

  // Note: For simplicity don't sort the entries but keep the order from the API; this also has the
  // advantage that the latest versions come first, so compared to appending versions at the end
  // this will not cause redundant Git diff due to trailing `,` being forbidden by JSON

  /**
   * @typedef {Object} FileVersionEntry
   * @property {string} version
   * @property {string} checksum
   */
  /** @type {FileVersionEntry[]} */
  const fileVersions = []
  for (const entry of versions) {
    /** @type {string} */
    // @ts-ignore
    const checksumUrl = entry.wrapperChecksumUrl
    const checksum = await httpGetText(checksumUrl)
    fileVersions.push({version: entry.version, checksum})
  }

  const jsonPath = path.resolve(
    __dirname,
    '..',
    '..',
    'src',
    'wrapper-checksums.json'
  )
  console.info(`Writing checksums file to ${jsonPath}`)
  // Write pretty-printed JSON (and add trailing line break)
  fs.writeFileSync(jsonPath, JSON.stringify(fileVersions, null, 2) + '\n')
}

main().catch(e => {
  console.error(e)
  // Manually set error exit code, otherwise error is logged but script exits successfully
  process.exitCode = 1
})
