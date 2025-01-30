import * as core from '@actions/core'
import * as exec from '@actions/exec'

import * as crypto from 'crypto'
import * as path from 'path'
import * as fs from 'fs'

import {CacheEntryListener} from './cache-reporting'
import {CacheResult, getCache} from './cache-api'

export function isCacheDebuggingEnabled(): boolean {
    if (core.isDebug()) {
        return true
    }
    return process.env['GRADLE_BUILD_ACTION_CACHE_DEBUG_ENABLED'] ? true : false
}

export function hashFileNames(fileNames: string[]): string {
    return hashStrings(fileNames.map(x => x.replace(new RegExp(`\\${path.sep}`, 'g'), '/')))
}

export function hashStrings(values: string[]): string {
    const hash = crypto.createHash('md5')
    for (const value of values) {
        hash.update(value)
    }
    return hash.digest('hex')
}

export async function restoreCache(
    cachePaths: string[],
    cacheKey: string,
    cacheRestoreKeys: string[],
    listener: CacheEntryListener
): Promise<CacheResult | undefined> {
    listener.markRequested(cacheKey, cacheRestoreKeys)
    try {
        const startTime = Date.now()
        const restoredEntry = await getCache().restore(cachePaths, cacheKey, cacheRestoreKeys)
        if (restoredEntry !== undefined) {
            const restoreTime = Date.now() - startTime
            listener.markRestored(restoredEntry.key, restoredEntry.size, restoreTime)
        }
        return restoredEntry
    } catch (error) {
        listener.markNotRestored((error as Error).message)
        handleCacheFailure(error, `Failed to restore ${cacheKey}`)
        return undefined
    }
}

export async function saveCache(cachePaths: string[], cacheKey: string, listener: CacheEntryListener): Promise<void> {
    try {
        const startTime = Date.now()
        const saveResult = await getCache().save(cachePaths, cacheKey)
        const saveTime = Date.now() - startTime
        if (saveResult.size === 0) {
            listener.markAlreadyExists(cacheKey)
        } else {
            listener.markSaved(saveResult.key, saveResult.size, saveTime)
        }
    } catch (error) {
        listener.markNotSaved((error as Error).message)
        handleCacheFailure(error, `Failed to save cache entry with path '${cachePaths}' and key: ${cacheKey}`)
    }
}

export function cacheDebug(message: string): void {
    if (isCacheDebuggingEnabled()) {
        core.info(message)
    } else {
        core.debug(message)
    }
}

export function handleCacheFailure(error: unknown, message: string): void {
    // Warn on and continue on any cache error
    core.warning(`${message}: ${error}`)
    if (error instanceof Error && error.stack) {
        cacheDebug(error.stack)
    }
}

/**
 * Attempt to delete a file or directory, waiting to allow locks to be released
 */
export async function tryDelete(file: string): Promise<void> {
    const maxAttempts = 5
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (!fs.existsSync(file)) {
            return
        }
        try {
            const stat = fs.lstatSync(file)
            if (stat.isDirectory()) {
                fs.rmSync(file, {recursive: true})
            } else {
                fs.unlinkSync(file)
            }
            return
        } catch (error) {
            if (attempt === maxAttempts) {
                core.warning(`Failed to delete ${file}, which will impact caching. 
It is likely locked by another process. Output of 'jps -ml':
${await getJavaProcesses()}`)
                throw error
            } else {
                cacheDebug(`Attempt to delete ${file} failed. Will try again.`)
                await delay(1000)
            }
        }
    }
}

async function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function getJavaProcesses(): Promise<string> {
    const jpsOutput = await exec.getExecOutput('jps', ['-lm'])
    return jpsOutput.stdout
}
