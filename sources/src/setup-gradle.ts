import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as path from 'path'
import * as os from 'os'
import * as caches from './caching/caches'
import * as jobSummary from './job-summary'
import * as buildScan from './build-scan'

import {loadBuildResults, markBuildResultsProcessed} from './build-results'
import {CacheListener, generateCachingReport} from './caching/cache-reporting'
import {DaemonController} from './daemon-controller'
import {BuildScanConfig, CacheConfig, SummaryConfig, getWorkspaceDirectory} from './configuration'
import {findInvalidWrapperJars} from './wrapper-validation/validate'
import {JobFailure} from './errors'

const GRADLE_SETUP_VAR = 'GRADLE_BUILD_ACTION_SETUP_COMPLETED'
const USER_HOME = 'USER_HOME'
const GRADLE_USER_HOME = 'GRADLE_USER_HOME'
const CACHE_LISTENER = 'CACHE_LISTENER'

export async function setup(cacheConfig: CacheConfig, buildScanConfig: BuildScanConfig): Promise<boolean> {
    const userHome = await determineUserHome()
    const gradleUserHome = await determineGradleUserHome()

    // Bypass setup on all but first action step in workflow.
    if (process.env[GRADLE_SETUP_VAR]) {
        core.info('Gradle setup only performed on first gradle/actions step in workflow.')
        return false
    }
    // Record setup complete: visible to all subsequent actions and prevents duplicate setup
    core.exportVariable(GRADLE_SETUP_VAR, true)
    // Record setup complete: visible in post-action, to control action completion
    core.saveState(GRADLE_SETUP_VAR, true)

    // Save the User Home and Gradle User Home for use in the post-action step.
    core.saveState(USER_HOME, userHome)
    core.saveState(GRADLE_USER_HOME, gradleUserHome)

    const cacheListener = new CacheListener()
    await caches.restore(userHome, gradleUserHome, cacheListener, cacheConfig)

    core.saveState(CACHE_LISTENER, cacheListener.stringify())

    await buildScan.setup(buildScanConfig)

    return true
}

export async function complete(cacheConfig: CacheConfig, summaryConfig: SummaryConfig): Promise<boolean> {
    if (!core.getState(GRADLE_SETUP_VAR)) {
        core.info('Gradle setup post-action only performed for first gradle/actions step in workflow.')
        return false
    }
    core.info('In post-action step')

    const buildResults = loadBuildResults()

    const userHome = core.getState(USER_HOME)
    const gradleUserHome = core.getState(GRADLE_USER_HOME)
    const cacheListener: CacheListener = CacheListener.rehydrate(core.getState(CACHE_LISTENER))

    const daemonController = new DaemonController(buildResults)
    await caches.save(userHome, gradleUserHome, cacheListener, daemonController, cacheConfig)

    const cachingReport = generateCachingReport(cacheListener)
    await jobSummary.generateJobSummary(buildResults, cachingReport, summaryConfig)

    markBuildResultsProcessed()

    core.info('Completed post-action step')

    return true
}

async function determineGradleUserHome(): Promise<string> {
    const customGradleUserHome = process.env['GRADLE_USER_HOME']
    if (customGradleUserHome) {
        const rootDir = getWorkspaceDirectory()
        return path.resolve(rootDir, customGradleUserHome)
    }

    return path.resolve(await determineUserHome(), '.gradle')
}

/**
 * Different values can be returned by os.homedir() in Javascript and System.getProperty('user.home') in Java.
 * In order to determine the correct Gradle User Home, we ask Java for the user home instead of using os.homedir().
 */
async function determineUserHome(): Promise<string> {
    const output = await exec.getExecOutput('java', ['-XshowSettings:properties', '-version'], {silent: true})
    const regex = /user\.home = (\S*)/i
    const found = output.stderr.match(regex)
    if (found == null || found.length <= 1) {
        core.info('Could not determine user.home from java -version output. Using os.homedir().')
        return os.homedir()
    }
    const userHome = found[1]
    core.debug(`Determined user.home from java -version output: '${userHome}'`)
    return userHome
}

export async function checkNoInvalidWrapperJars(rootDir = getWorkspaceDirectory()): Promise<void> {
    const allowedChecksums = process.env['ALLOWED_GRADLE_WRAPPER_CHECKSUMS']?.split(',') || []
    const result = await findInvalidWrapperJars(rootDir, 1, false, allowedChecksums)
    if (result.isValid()) {
        core.info(result.toDisplayString())
    } else {
        core.info(result.toDisplayString())
        throw new JobFailure(
            `Gradle Wrapper Validation Failed!\n  See https://github.com/gradle/actions/blob/main/docs/wrapper-validation.md#reporting-failures\n${result.toDisplayString()}`
        )
    }
}
