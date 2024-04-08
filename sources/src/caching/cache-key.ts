import * as github from '@actions/github'

import {CacheConfig, getJobMatrix} from '../input-params'
import {hashStrings} from './cache-utils'

const CACHE_PROTOCOL_VERSION = 'v9-'

const CACHE_KEY_PREFIX_VAR = 'GRADLE_BUILD_ACTION_CACHE_KEY_PREFIX'
const CACHE_KEY_OS_VAR = 'GRADLE_BUILD_ACTION_CACHE_KEY_ENVIRONMENT'
const CACHE_KEY_JOB_VAR = 'GRADLE_BUILD_ACTION_CACHE_KEY_JOB'
const CACHE_KEY_JOB_INSTANCE_VAR = 'GRADLE_BUILD_ACTION_CACHE_KEY_JOB_INSTANCE'
const CACHE_KEY_JOB_EXECUTION_VAR = 'GRADLE_BUILD_ACTION_CACHE_KEY_JOB_EXECUTION'

/**
 * Represents a key used to restore a cache entry.
 * The Github Actions cache will first try for an exact match on the key.
 * If that fails, it will try for a prefix match on any of the restoreKeys.
 */
export class CacheKey {
    key: string
    restoreKeys: string[]

    constructor(key: string, restoreKeys: string[]) {
        this.key = key
        this.restoreKeys = restoreKeys
    }
}

/**
 * Generates a cache key specific to the current job execution.
 * The key is constructed from the following inputs (with some user overrides):
 * - The cache protocol version
 * - The name of the cache
 * - The runner operating system
 * - The name of the workflow and Job being executed
 * - The matrix values for the Job being executed (job context)
 * - The SHA of the commit being executed
 *
 * Caches are restored by trying to match the these key prefixes in order:
 * - The full key with SHA
 * - A previous key for this Job + matrix
 * - Any previous key for this Job (any matrix)
 * - Any previous key for this cache on the current OS
 */
export function generateCacheKey(cacheName: string, config: CacheConfig): CacheKey {
    const cacheKeyBase = `${getCacheKeyPrefix()}${CACHE_PROTOCOL_VERSION}${cacheName}`

    // At the most general level, share caches for all executions on the same OS
    const cacheKeyForEnvironment = `${cacheKeyBase}|${getCacheKeyEnvironment()}`

    // Then prefer caches that run job with the same ID
    const cacheKeyForJob = `${cacheKeyForEnvironment}|${getCacheKeyJob()}`

    // Prefer (even more) jobs that run this job in the same workflow with the same context (matrix)
    const cacheKeyForJobContext = `${cacheKeyForJob}[${getCacheKeyJobInstance()}]`

    // Exact match on Git SHA
    const cacheKey = `${cacheKeyForJobContext}-${getCacheKeyJobExecution()}`

    if (config.isCacheStrictMatch()) {
        return new CacheKey(cacheKey, [cacheKeyForJobContext])
    }

    return new CacheKey(cacheKey, [cacheKeyForJobContext, cacheKeyForJob, cacheKeyForEnvironment])
}

export function getCacheKeyPrefix(): string {
    // Prefix can be used to force change all cache keys (defaults to cache protocol version)
    return process.env[CACHE_KEY_PREFIX_VAR] || ''
}

function getCacheKeyEnvironment(): string {
    const runnerOs = process.env['RUNNER_OS'] || ''
    return process.env[CACHE_KEY_OS_VAR] || runnerOs
}

function getCacheKeyJob(): string {
    return process.env[CACHE_KEY_JOB_VAR] || github.context.job
}

function getCacheKeyJobInstance(): string {
    const override = process.env[CACHE_KEY_JOB_INSTANCE_VAR]
    if (override) {
        return override
    }

    // By default, we hash the workflow name and the full `matrix` data for the run, to uniquely identify this job invocation
    // The only way we can obtain the `matrix` data is via the `workflow-job-context` parameter in action.yml.
    const workflowName = github.context.workflow
    const workflowJobContext = getJobMatrix()
    return hashStrings([workflowName, workflowJobContext])
}

function getCacheKeyJobExecution(): string {
    // Used to associate a cache key with a particular execution (default is bound to the git commit sha)
    return process.env[CACHE_KEY_JOB_EXECUTION_VAR] || github.context.sha
}
