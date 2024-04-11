import * as core from '@actions/core'

export class PostActionJobFailure extends Error {
    constructor(error: unknown) {
        if (error instanceof Error) {
            super(error.message)
            this.name = error.name
            this.stack = error.stack
        } else {
            super(String(error))
        }
    }
}

export function handleMainActionError(error: unknown): void {
    if (error instanceof AggregateError) {
        core.setFailed(`Multiple errors returned`)
        for (const err of error.errors) {
            core.error(`Error ${error.errors.indexOf(err)}: ${err.message}`)
            if (err.stack) {
                core.info(err.stack)
            }
        }
    } else {
        core.setFailed(String(error))
        if (error instanceof Error && error.stack) {
            core.info(error.stack)
        }
    }
}

export function handlePostActionError(error: unknown): void {
    if (error instanceof PostActionJobFailure) {
        core.setFailed(String(error))
    } else {
        core.warning(`Unhandled error in Gradle post-action - job will continue: ${error}`)
        if (error instanceof Error && error.stack) {
            core.info(error.stack)
        }
    }
}
