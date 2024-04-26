import * as httpm from 'typed-rest-client/HttpClient'
import * as core from '@actions/core'

export async function getToken(
    enforceUrl: string | undefined,
    serverUrl: string | undefined,
    accessKey: string,
    expiry: string
): Promise<DevelocityAccessCredentials | null> {
    const empty: Promise<DevelocityAccessCredentials | null> = new Promise(r => r(null))
    const develocityAccessKey = DevelocityAccessCredentials.parse(accessKey)
    const shortLivedTokenClient = new ShortLivedTokenClient()

    async function promiseError(message: string): Promise<DevelocityAccessCredentials | null> {
        return new Promise((resolve, reject) => reject(new Error(message)))
    }

    if (develocityAccessKey == null) {
        return empty
    }
    if (enforceUrl === 'true' || develocityAccessKey.isSingleKey()) {
        if (!serverUrl) {
            return promiseError('Develocity Server URL not configured')
        }
        const hostname = extractHostname(serverUrl)
        if (hostname == null) {
            return promiseError('Could not extract hostname from Develocity server URL')
        }
        const hostAccessKey = develocityAccessKey.forHostname(hostname)
        if (!hostAccessKey) {
            return promiseError(`Could not find corresponding key for hostname ${hostname}`)
        }
        try {
            const token = await shortLivedTokenClient.fetchToken(serverUrl, hostAccessKey, expiry)
            return DevelocityAccessCredentials.of([token])
        } catch (e) {
            return new Promise((resolve, reject) => reject(e))
        }
    }

    const tokens = new Array<HostnameAccessKey>()
    for (const k of develocityAccessKey.keys) {
        try {
            const token = await shortLivedTokenClient.fetchToken(`https://${k.hostname}`, k, expiry)
            tokens.push(token)
        } catch (e) {
            // Ignoring failed token, TODO: log this ?
        }
    }
    if (tokens.length > 0) {
        return DevelocityAccessCredentials.of(tokens)
    }
    return empty
}

function extractHostname(serverUrl: string): string | null {
    try {
        const parsedUrl = new URL(serverUrl)
        return parsedUrl.hostname
    } catch (error) {
        return null
    }
}

class ShortLivedTokenClient {
    httpc = new httpm.HttpClient('gradle/setup-gradle')
    maxRetries = 3
    retryInterval = 1000

    async fetchToken(serverUrl: string, accessKey: HostnameAccessKey, expiry: string): Promise<HostnameAccessKey> {
        const queryParams = expiry ? `?expiresInHours${expiry}` : ''
        const sanitizedServerUrl = !serverUrl.endsWith('/') ? `${serverUrl}/` : serverUrl
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessKey.key}`
        }

        let attempts = 0
        while (attempts < this.maxRetries) {
            try {
                const requestUrl = `${sanitizedServerUrl}api/auth/token${queryParams}`
                core.debug(`Attempt ${attempts} to fetch short lived token at ${requestUrl}`)
                const response = await this.httpc.post(requestUrl, '', headers)
                if (response.message.statusCode === 200) {
                    const text = await response.readBody()
                    return new Promise<HostnameAccessKey>(resolve => resolve({hostname: accessKey.hostname, key: text}))
                }
                // This should be only 404
                attempts++
                if (attempts === this.maxRetries) {
                    return new Promise((resolve, reject) =>
                        reject(
                            new Error(
                                `Develocity short lived token request failed ${serverUrl} with status code ${response.message.statusCode}`
                            )
                        )
                    )
                }
            } catch (error) {
                attempts++
                if (attempts === this.maxRetries) {
                    return new Promise((resolve, reject) => reject(error))
                }
            }
            await new Promise(resolve => setTimeout(resolve, this.retryInterval))
        }
        return new Promise((resolve, reject) => reject(new Error('Illegal state')))
    }
}

type HostnameAccessKey = {
    hostname: string
    key: string
}

export class DevelocityAccessCredentials {
    static readonly accessKeyRegexp = /^(\S+=\w+)(;\S+=\w+)*$/
    readonly keys: HostnameAccessKey[]

    private constructor(allKeys: HostnameAccessKey[]) {
        this.keys = allKeys
    }

    static of(allKeys: HostnameAccessKey[]): DevelocityAccessCredentials {
        return new DevelocityAccessCredentials(allKeys)
    }

    private static readonly keyDelimiter = ';'
    private static readonly hostDelimiter = '='

    static parse(rawKey: string): DevelocityAccessCredentials | null {
        if (!this.isValid(rawKey)) {
            return null
        }
        return new DevelocityAccessCredentials(
            rawKey.split(this.keyDelimiter).map(hostKey => {
                const pair = hostKey.split(this.hostDelimiter)
                return {hostname: pair[0], key: pair[1]}
            })
        )
    }

    isEmpty(): boolean {
        return this.keys.length === 0
    }

    isSingleKey(): boolean {
        return this.keys.length === 1
    }

    forHostname(hostname: string): HostnameAccessKey | undefined {
        return this.keys.find(hostKey => hostKey.hostname === hostname)
    }

    raw(): string {
        return this.keys
            .map(k => `${k.hostname}${DevelocityAccessCredentials.hostDelimiter}${k.key}`)
            .join(DevelocityAccessCredentials.keyDelimiter)
    }

    private static isValid(allKeys: string): boolean {
        return this.accessKeyRegexp.test(allKeys)
    }
}
