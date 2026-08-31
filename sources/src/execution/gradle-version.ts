export class GradleVersion {
    static PATTERN = /((\d+)(\.\d+)+)(-([a-z]+)-(\w+))?(-(SNAPSHOT|\d{14}([-+]\d{4})?))?/

    readonly major: number
    readonly minor: number
    readonly patch: number
    readonly versionPart: string
    readonly stagePart: string | undefined
    readonly snapshotPart: string | undefined

    constructor(readonly version: string) {
        const matcher = GradleVersion.PATTERN.exec(version)
        if (!matcher) {
            throw new Error(`'${version}' is not a valid Gradle version string (examples: '1.0', '1.0-rc-1')`)
        }

        this.versionPart = matcher[1]
        this.stagePart = matcher[4]
        this.snapshotPart = matcher[7]

        const parts = this.versionPart.split('.')
        this.major = Number(parts[0])
        this.minor = Number(parts[1])
        this.patch = parts.length > 2 ? Number(parts[2]) : 0
    }

    isFinalRelease(): boolean {
        return !this.stagePart && !this.snapshotPart
    }

    /** Returns undefined rather than throwing, for versions from an untrusted source. */
    static parse(version: string): GradleVersion | undefined {
        try {
            return new GradleVersion(version)
        } catch {
            return undefined
        }
    }

    static readonly compare = (a: GradleVersion, b: GradleVersion): number =>
        a.major - b.major || a.minor - b.minor || a.patch - b.patch
}
