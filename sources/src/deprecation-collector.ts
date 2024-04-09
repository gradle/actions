import * as core from '@actions/core'
import * as github from '@actions/github'

const DEPRECATION_UPGRADE_PAGE = 'https://github.com/gradle/actions/blob/main/docs/deprecation-upgrade-guide.md'
const recordedDeprecations: Deprecation[] = []

export class Deprecation {
    constructor(readonly message: string) {}

    getDocumentationLink(): string {
        const deprecationAnchor = this.message
            .toLowerCase()
            .replace(/[^\w\s-]|_/g, '')
            .replace(/ /g, '-')
        return `${DEPRECATION_UPGRADE_PAGE}#${deprecationAnchor}`
    }
}

export function recordDeprecation(message: string): void {
    if (!recordedDeprecations.some(deprecation => deprecation.message === message)) {
        recordedDeprecations.push(new Deprecation(message))
    }
}

export function getDeprecations(): Deprecation[] {
    return recordedDeprecations
}

export function emitDeprecationWarnings(): void {
    if (recordedDeprecations.length > 0) {
        core.warning(
            `This job uses deprecated functionality from the '${github.context.action}' action. Consult the Job Summary for more details.`
        )
        for (const deprecation of recordedDeprecations) {
            core.info(`DEPRECATION: ${deprecation.message}. See ${deprecation.getDocumentationLink()}`)
        }
    }
}

export function saveDeprecationState(): void {
    core.saveState('deprecations', JSON.stringify(recordedDeprecations))
}

export function restoreDeprecationState(): void {
    const stringRep = core.getState('deprecations')
    if (stringRep === '') {
        return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    JSON.parse(stringRep).forEach((obj: any) => {
        recordedDeprecations.push(new Deprecation(obj.message))
    })
}
