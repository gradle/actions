const WINDOWS_EXIT_DELAY_MS = 50

export function getForcedExitDelayMs(platform: NodeJS.Platform = process.platform): number {
    return platform === 'win32' ? WINDOWS_EXIT_DELAY_MS : 0
}

export async function forceExit(platform: NodeJS.Platform = process.platform): Promise<never> {
    const exitDelayMs = getForcedExitDelayMs(platform)
    if (exitDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, exitDelayMs))
    }

    return process.exit()
}
