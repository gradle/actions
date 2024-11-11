import * as checksums from '../../../src/wrapper-validation/checksums'
import nock from 'nock'
import {afterEach, describe, expect, test, jest} from '@jest/globals'

jest.setTimeout(30000)

test('has loaded hardcoded wrapper jars checksums', async () => {
  // Sanity check that generated checksums file is not empty and was properly imported
  expect(checksums.KNOWN_CHECKSUMS.checksums.size).toBeGreaterThan(10)
  // Verify that checksums of arbitrary versions are contained
  expect(
    checksums.KNOWN_CHECKSUMS.checksums.get(
      '660ab018b8e319e9ae779fdb1b7ac47d0321bde953bf0eb4545f14952cfdcaa3'
    )
  ).toEqual(new Set(['4.10.3']))
  expect(
    checksums.KNOWN_CHECKSUMS.checksums.get(
      '28b330c20a9a73881dfe9702df78d4d78bf72368e8906c70080ab6932462fe9e'
    )
  ).toEqual(new Set(['6.0-rc-1', '6.0-rc-2', '6.0-rc-3', '6.0', '6.0.1']))
})

test('fetches wrapper jars checksums', async () => {
  const validChecksums = await checksums.fetchUnknownChecksums(false, new checksums.WrapperChecksums)
  expect(validChecksums.size).toBeGreaterThan(10)
  // Verify that checksum of arbitrary version is contained
  expect(
    validChecksums.has(
      // Checksum for version 6.0
      '28b330c20a9a73881dfe9702df78d4d78bf72368e8906c70080ab6932462fe9e'
    )
  ).toBe(true)
})

test('fetches wrapper jar checksums for snapshots', async () => {
  const nonSnapshotChecksums = await checksums.fetchUnknownChecksums(false, new checksums.WrapperChecksums)
  const validChecksums = await checksums.fetchUnknownChecksums(true, new checksums.WrapperChecksums)

  // Expect that at least one snapshot checksum is different from the non-snapshot checksums
  expect(nonSnapshotChecksums.size).toBeGreaterThan(10)
  expect(validChecksums.size).toBeGreaterThanOrEqual(nonSnapshotChecksums.size)
})

test('fetches all wrapper checksum URLS for snapshots', async () => {
  const checksumUrls: string[] = []
  await checksums.addDistributionSnapshotChecksums(checksumUrls)

  expect(checksumUrls.length).toBeGreaterThan(100) // May only be a few unique checksums
  console.log(checksumUrls)
})

describe('retry', () => {
  afterEach(() => {
    nock.cleanAll()
  })

  describe('for /versions/all API', () => {
    test('retry three times', async () => {
      nock('https://services.gradle.org', {allowUnmocked: true})
        .get('/versions/all')
        .times(3)
        .replyWithError({
          message: 'connect ECONNREFUSED 104.18.191.9:443',
          code: 'ECONNREFUSED'
        })

      const validChecksums = await checksums.fetchUnknownChecksums(false, new checksums.WrapperChecksums)
      expect(validChecksums.size).toBeGreaterThan(10)
      nock.isDone()
    })
  })
})
