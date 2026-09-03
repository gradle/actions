/** A pre-release stage of a Gradle version, ranked so lower ranks order earlier. */
interface Stage {
    readonly rank: number
    readonly number: number
    readonly patchNo: string
}

/**
 * A Gradle version, parsed and ordered the same way Gradle's own `org.gradle.util.GradleVersion` does:
 * base version numbers first, then pre-release stage (milestone < preview < rc < final), then snapshot
 * (a snapshot precedes the release it leads to; timestamps order by their actual instant).
 */
export class GradleVersion {
    private static readonly PATTERN = /^((\d+)(\.\d+)+)(-([a-zA-Z]+)-(\w+))?(-(SNAPSHOT|\d{14}([-+]\d{4})?))?$/

    // Ranks match Gradle's stage numbers; anything unrecognised sits between milestone and preview.
    private static readonly STAGE_RANK: Record<string, number> = {milestone: 0, preview: 2, rc: 3}
    private static readonly STAGE_UNKNOWN = 1

    readonly major: number
    readonly minor: number
    readonly patch: number

    private readonly versionPart: string
    private readonly stage: Stage | undefined
    private readonly snapshot: number | undefined

    constructor(readonly version: string) {
        const matcher = GradleVersion.PATTERN.exec(version)
        if (!matcher) {
            throw new Error(`'${version}' is not a valid Gradle version string (examples: '1.0', '1.0-rc-1')`)
        }

        this.versionPart = matcher[1]
        this.stage = GradleVersion.parseStage(matcher[5], matcher[6])
        this.snapshot = GradleVersion.parseSnapshot(matcher[8], matcher[9])

        const parts = this.versionPart.split('.')
        this.major = Number(parts[0])
        this.minor = Number(parts[1])
        this.patch = parts.length > 2 ? Number(parts[2]) : 0
    }

    isFinalRelease(): boolean {
        return this.stage === undefined && this.snapshot === undefined
    }

    /** Orders this version against another, following Gradle's own comparison rules. */
    compareTo(other: GradleVersion): number {
        const parts = this.versionPart.split('.')
        const otherParts = other.versionPart.split('.')
        for (let i = 0; i < parts.length && i < otherParts.length; i++) {
            if (Number(parts[i]) !== Number(otherParts[i])) {
                return Math.sign(Number(parts[i]) - Number(otherParts[i]))
            }
        }
        if (parts.length !== otherParts.length) {
            return Math.sign(parts.length - otherParts.length)
        }

        if (this.stage && other.stage) {
            const stageDiff = GradleVersion.compareStages(this.stage, other.stage)
            if (stageDiff !== 0) {
                return stageDiff
            }
        } else if (this.stage) {
            return -1 // a staged version precedes the final release of the same base
        } else if (other.stage) {
            return 1
        }

        // A version with no snapshot is newer than any snapshot of the same base.
        const thisSnapshot = this.snapshot ?? Number.MAX_SAFE_INTEGER
        const otherSnapshot = other.snapshot ?? Number.MAX_SAFE_INTEGER
        if (thisSnapshot !== otherSnapshot) {
            return Math.sign(thisSnapshot - otherSnapshot)
        }
        return this.version < other.version ? -1 : this.version > other.version ? 1 : 0
    }

    /** Returns undefined rather than throwing, for versions from an untrusted source. */
    static parse(version: string): GradleVersion | undefined {
        try {
            return new GradleVersion(version)
        } catch {
            return undefined
        }
    }

    static readonly compare = (a: GradleVersion, b: GradleVersion): number => a.compareTo(b)

    private static parseStage(name: string | undefined, numberPart: string | undefined): Stage | undefined {
        if (name === undefined) {
            return undefined
        }
        const rank = GradleVersion.STAGE_RANK[name.toLowerCase()] ?? GradleVersion.STAGE_UNKNOWN
        const match = /(\d+)([a-z])?/.exec(numberPart ?? '')
        return {rank, number: match ? Number(match[1]) : 0, patchNo: match?.[2] ?? '_'}
    }

    private static parseSnapshot(snapshot: string | undefined, timezone: string | undefined): number | undefined {
        if (snapshot === undefined) {
            return undefined
        }
        if (snapshot === 'SNAPSHOT') {
            return 0
        }
        // A 14-digit timestamp (yyyyMMddHHmmss), optionally with a timezone offset like +0000 (UTC when absent).
        const date = `${snapshot.slice(0, 4)}-${snapshot.slice(4, 6)}-${snapshot.slice(6, 8)}`
        const time = `${snapshot.slice(8, 10)}:${snapshot.slice(10, 12)}:${snapshot.slice(12, 14)}`
        const offset = timezone ? `${timezone.slice(0, 3)}:${timezone.slice(3, 5)}` : 'Z'
        return Date.parse(`${date}T${time}${offset}`)
    }

    private static compareStages(a: Stage, b: Stage): number {
        if (a.rank !== b.rank) {
            return Math.sign(a.rank - b.rank)
        }
        if (a.number !== b.number) {
            return Math.sign(a.number - b.number)
        }
        if (a.patchNo !== b.patchNo) {
            return a.patchNo < b.patchNo ? -1 : 1
        }
        return 0
    }
}
