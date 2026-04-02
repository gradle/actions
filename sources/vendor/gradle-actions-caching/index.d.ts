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
export declare interface CacheOptions {
    disabled: boolean;
    readOnly: boolean;
    writeOnly: boolean;
    overwriteExisting: boolean;
    strictMatch: boolean;
    cleanup: string;
    encryptionKey?: string;
    includes: string[];
    excludes: string[];
}

/** @public */
export declare function restore(gradleUserHome: string, cacheOptions: CacheOptions): Promise<void>;

/** @public */
export declare function save(gradleUserHome: string, buildResults: BuildResult[], cacheOptions: CacheOptions): Promise<string>;

export { }
