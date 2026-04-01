import * as core from '@actions/core'
import * as os from 'os'

import {CacheConfig, CacheOptions} from './cache-config-adapter'
import {BuildResult, BuildResults} from './build-results-adapter'
import {CacheListener, generateCachingReport} from './cache-reporting'
import {DaemonController} from './daemon-controller'
import * as caches from './caches'

const CACHE_LISTENER_STATE_KEY = 'legacy-cache-listener'

export async function restore(gradleUserHome: string, cacheOptions: CacheOptions): Promise<void> {
    const userHome = os.homedir()
    const cacheListener = new CacheListener()
    const cacheConfig = new CacheConfig(cacheOptions)

    await caches.restore(userHome, gradleUserHome, cacheListener, cacheConfig)

    // Persist the listener so it can be rehydrated in save()
    core.saveState(CACHE_LISTENER_STATE_KEY, cacheListener.stringify())
}

export async function save(
    gradleUserHome: string,
    buildResults: BuildResult[],
    cacheOptions: CacheOptions
): Promise<string> {
    const userHome = os.homedir()
    const cacheConfig = new CacheConfig(cacheOptions)

    // Rehydrate the listener from the restore phase
    const listenerState = core.getState(CACHE_LISTENER_STATE_KEY)
    const cacheListener = CacheListener.rehydrate(listenerState)

    const buildResultsWrapper = new BuildResults(buildResults)
    const daemonController = new DaemonController(buildResultsWrapper)

    await caches.save(userHome, gradleUserHome, cacheListener, daemonController, buildResultsWrapper, cacheConfig)

    return generateCachingReport(cacheListener)
}
