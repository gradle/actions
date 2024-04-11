import * as path from 'path'
import * as validate from '../../../src/wrapper-validation/validate'
import {expect, test, jest} from '@jest/globals'

jest.setTimeout(30000)

const baseDir = path.resolve('./test/jest/wrapper-validation')

test('succeeds if all found wrapper jars are valid', async () => {
  const result = await validate.findInvalidWrapperJars(baseDir, 3, false, [
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  ])

  expect(result.isValid()).toBe(true)
  // Only hardcoded and explicitly allowed checksums should have been used
  expect(result.fetchedChecksums).toBe(false)

  expect(result.toDisplayString()).toBe(
    '✓ Found known Gradle Wrapper JAR files:\n' +
      '  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 data/invalid/gradle-wrapper.jar\n' +
      '  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 data/invalid/gradlе-wrapper.jar\n' + // homoglyph
      '  3888c76faa032ea8394b8a54e04ce2227ab1f4be64f65d450f8509fe112d38ce data/valid/gradle-wrapper.jar'
  )
})

test('succeeds if all found wrapper jars are valid (and checksums are fetched from Gradle API)', async () => {
  const knownValidChecksums = new Map<string, Set<string>>()
  const result = await validate.findInvalidWrapperJars(
    baseDir,
    1,
    false,
    ['e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    knownValidChecksums
  )

  expect(result.isValid()).toBe(true)
  // Should have fetched checksums because no known checksums were provided
  expect(result.fetchedChecksums).toBe(true)

  expect(result.toDisplayString()).toBe(
    '✓ Found known Gradle Wrapper JAR files:\n' +
      '  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 data/invalid/gradle-wrapper.jar\n' +
      '  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 data/invalid/gradlе-wrapper.jar\n' + // homoglyph
      '  3888c76faa032ea8394b8a54e04ce2227ab1f4be64f65d450f8509fe112d38ce data/valid/gradle-wrapper.jar'
  )
})

test('fails if invalid wrapper jars are found', async () => {
  const result = await validate.findInvalidWrapperJars(baseDir, 3, false, [])

  expect(result.isValid()).toBe(false)

  expect(result.valid).toEqual([
    new validate.WrapperJar(
      'data/valid/gradle-wrapper.jar',
      '3888c76faa032ea8394b8a54e04ce2227ab1f4be64f65d450f8509fe112d38ce'
    )
  ])

  expect(result.invalid).toEqual([
    new validate.WrapperJar(
      'data/invalid/gradle-wrapper.jar',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    ),
    new validate.WrapperJar(
      'data/invalid/gradlе-wrapper.jar', // homoglyph
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    )
  ])

  expect(result.toDisplayString()).toBe(
    '✗ Found unknown Gradle Wrapper JAR files:\n' +
      '  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 data/invalid/gradle-wrapper.jar\n' +
      '  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 data/invalid/gradlе-wrapper.jar\n' + // homoglyph
      '✓ Found known Gradle Wrapper JAR files:\n' +
      '  3888c76faa032ea8394b8a54e04ce2227ab1f4be64f65d450f8509fe112d38ce data/valid/gradle-wrapper.jar'
  )
})

test('fails if not enough wrapper jars are found', async () => {
  const result = await validate.findInvalidWrapperJars(baseDir, 4, false, [])

  expect(result.isValid()).toBe(false)

  expect(result.errors).toEqual([
    'Expected to find at least 4 Gradle Wrapper JARs but got only 3'
  ])

  expect(result.toDisplayString()).toBe(
    '✗ Found unknown Gradle Wrapper JAR files:\n' +
      '  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 data/invalid/gradle-wrapper.jar\n' +
      '  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 data/invalid/gradlе-wrapper.jar\n' + // homoglyph
      '✗ Other validation errors:\n' +
      '  Expected to find at least 4 Gradle Wrapper JARs but got only 3\n' +
      '✓ Found known Gradle Wrapper JAR files:\n' +
      '  3888c76faa032ea8394b8a54e04ce2227ab1f4be64f65d450f8509fe112d38ce data/valid/gradle-wrapper.jar'
  )
})
