import {BuildResult} from './build-results'

export interface CacheOptions {
    disabled: boolean
    readOnly: boolean
    writeOnly: boolean
    overwriteExisting: boolean
    strictMatch: boolean
    cleanup: string
    encryptionKey?: string
    includes: string[]
    excludes: string[]
}

export interface CacheService {
    restore(gradleUserHome: string, cacheOptions: CacheOptions): Promise<void>
    save(gradleUserHome: string, buildResults: BuildResult[], cacheOptions: CacheOptions): Promise<string>
}
