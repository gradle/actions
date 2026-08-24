export class GradleVersion {
    static PATTERN = /((\d+)(\.\d+)+)(-([a-z]+)-(\w+))?(-(SNAPSHOT|\d{14}([-+]\d{4})?))?/

    major: number
    versionPart: string
    stagePart: string
    snapshotPart: string

    constructor(readonly version: string) {
        const matcher = GradleVersion.PATTERN.exec(version)
        if (!matcher) {
            throw new Error(`'${version}' is not a valid Gradle version string (examples: '1.0', '1.0-rc-1')`)
        }

        this.major = Number(matcher[2])
        this.versionPart = matcher[1]
        this.stagePart = matcher[4]
        this.snapshotPart = matcher[7]
    }

    isFinalRelease(): boolean {
        return !this.stagePart && !this.snapshotPart
    }
}
