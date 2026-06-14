/** @public */
export declare interface BuildResult {
    get rootProjectName(): string;
    get rootProjectDir(): string;
    get requestedTasks(): string;
    get gradleVersion(): string;
    get gradleHomeDir(): string;
    get buildFailed(): boolean;
    get configCacheHit(): boolean;
    get buildScanUri(): string;
    get buildScanFailed(): boolean;
}

/** @public */
export declare type CacheCleanupStatus = 'enabled' | 'disabled-param' | 'disabled-failure' | 'disabled-config-cache-hit' | 'disabled-readonly';

/** @public */
export declare interface CacheEntryReport {
    entryName: string;
    requestedKey?: string;
    restoredKey?: string;
    restoredSize?: number;
    restoredTime?: number;
    restoredOutcome: string;
    savedKey?: string;
    savedSize?: number;
    savedTime?: number;
    savedOutcome: string;
}

/** @public */
export declare interface CacheOptions {
    disabled: boolean;
    readOnly: boolean;
    writeOnly: boolean;
    overwriteExisting: boolean;
    strictMatch: boolean;
    cleanup: 'always' | 'on-success' | 'never';
    encryptionKey?: string;
    develocityAccessToken?: string;
    develocityServerUrl?: string;
    includes: string[];
    excludes: string[];
}

/** @public */
export declare interface CacheReport {
    status: CacheStatus;
    cleanup?: CacheCleanupStatus;
    projectCache?: ProjectCacheStatus;
    entries: CacheEntryReport[];
}

/** @public */
export declare type CacheStatus = 'enabled' | 'read-only' | 'write-only' | 'disabled' | 'disabled-existing-home' | 'not-available';

/**
 * Status of project-entry caching (build-logic artifacts + configuration-cache data) for a run.
 * The first three are set on restore (always ungated); the rest are set on save and reflect the
 * two-tier gate (opt-in + Develocity trial, then encryption key + Gradle version). Still beta.
 *
 * @public
 */
declare type ProjectCacheStatus = 'not-enabled' | 'trial-expired' | 'trial-not-licensed' | 'no-encryption-key' | 'enabled';

/** @public */
export declare function restore(gradleUserHome: string, cacheOptions: CacheOptions): Promise<void>;

/** @public */
export declare function save(gradleUserHome: string, buildResults: BuildResult[], cacheOptions: CacheOptions): Promise<CacheReport>;

export { }
