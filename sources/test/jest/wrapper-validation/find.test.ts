import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as find from '../../../src/wrapper-validation/find'
import {expect, test} from '@jest/globals'

test('finds test data wrapper jars', async () => {
  const repoRoot = path.resolve('./test/jest/wrapper-validation')
  const wrapperJars = await find.findWrapperJars(repoRoot)
  expect(wrapperJars.length).toBe(3)
  expect(wrapperJars).toContain('data/valid/gradle-wrapper.jar')
  expect(wrapperJars).toContain('data/invalid/gradle-wrapper.jar')
  expect(wrapperJars).toContain('data/invalid/gradlе-wrapper.jar') // homoglyph
})

// A directory with more entries than V8 accepts as call arguments
// (about 125k with the default stack size), such as a cache directory
// inside a persistent workspace.
test('finds wrapper jars next to a very wide directory', async () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wrapper-validation-wide-'))
  try {
    const wideDir = path.join(baseDir, 'wide')
    fs.mkdirSync(wideDir)
    for (let i = 0; i < 150_000; i++) {
      fs.writeFileSync(path.join(wideDir, `entry-${i}`), '')
    }
    fs.mkdirSync(path.join(baseDir, 'gradle', 'wrapper'), {recursive: true})
    fs.writeFileSync(path.join(baseDir, 'gradle', 'wrapper', 'gradle-wrapper.jar'), '')

    const wrapperJars = await find.findWrapperJars(baseDir)
    expect(wrapperJars).toEqual([path.join('gradle', 'wrapper', 'gradle-wrapper.jar')])
  } finally {
    fs.rmSync(baseDir, {recursive: true, force: true})
  }
}, 120000)
