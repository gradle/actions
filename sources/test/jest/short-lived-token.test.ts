import nock from "nock";
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

import {DevelocityAccessCredentials, getToken, resolveTokenForServer} from "../../src/develocity/short-lived-token";

describe('access key format warnings', () => {
    // `core.warning` is an ESM export and cannot be spied on, so capture the workflow command it
    // writes to stdout instead.
    let stdout: jest.SpiedFunction<typeof process.stdout.write>

    const warnings = (): string[] =>
        stdout.mock.calls
            .map(call => String(call[0]))
            .filter(line => line.startsWith('::warning::'))
            .map(line => line.substring('::warning::'.length).trim())

    beforeEach(() => {
        stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
    })

    afterEach(() => {
        stdout.mockRestore()
    })

    it.each([
        ['no separator', 'host1', "no '=' separator in the value"],
        ['a trailing separator', 'host1=key1;', "no '=' separator in entry 2 of 2"],
        ['a leading separator', ';host1=key1', "no '=' separator in entry 1 of 2"],
        ['an empty hostname', '=key1', 'empty server name in the value'],
        ['an empty key', 'host1=', 'empty key in the value'],
        ['whitespace in the hostname', 'ho st1=key1', 'whitespace in the server name in the value'],
        ['whitespace in the key', 'host1=ke y1', 'whitespace in the key in the value'],
        ['whitespace around a separator', 'host1=key1; host2=key2', 'whitespace in the server name in entry 2 of 2'],
    ])('warns about %s', (_description, rawKey, expectedReason) => {
        expect(DevelocityAccessCredentials.parse(rawKey)).toBeNull()

        expect(warnings()).toEqual([
            `Ignoring badly formed Develocity access key: ${expectedReason}. The expected format is 'server=key[;server=key]*'.`
        ])
    })

    it('never includes any part of the access key value in the warning', () => {
        expect(DevelocityAccessCredentials.parse('my-host=my sec ret')).toBeNull()

        const message = warnings()[0]
        expect(message).not.toContain('my-host')
        expect(message).not.toContain('sec')
    })

    it('does not warn for a valid access key', () => {
        expect(DevelocityAccessCredentials.parse('host1=key1;host2=key2')).not.toBeNull()

        expect(warnings()).toEqual([])
    })

    it('does not warn for an empty access key', () => {
        expect(DevelocityAccessCredentials.parse('  ')).toBeNull()

        expect(warnings()).toEqual([])
    })
})

describe('short lived tokens', () => {
    it('parse valid access key should return an object', async () => {
        let develocityAccessCredentials = DevelocityAccessCredentials.parse('some-host.local=key1;host2=key2');

        expect(develocityAccessCredentials).toStrictEqual(DevelocityAccessCredentials.of([
            {hostname: 'some-host.local', key: 'key1'},
            {hostname: 'host2', key: 'key2'}])
        )
    })

    it('parse wrong access key should return null', async () => {
        let develocityAccessCredentials = DevelocityAccessCredentials.parse('random;foo');

        expect(develocityAccessCredentials).toBeNull()
    })

    it('parse access key with an OIDC token value should return an object', async () => {
        const oidcToken = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJyZXBvOmZvby9iYXI_-x=.c2lnbmF0dXJl=='
        let develocityAccessCredentials = DevelocityAccessCredentials.parse(`some-host.local=${oidcToken}`);

        expect(develocityAccessCredentials).toStrictEqual(DevelocityAccessCredentials.of([
            {hostname: 'some-host.local', key: oidcToken}])
        )
    })

    it('parse access key splits each entry on the first separator only', async () => {
        let develocityAccessCredentials = DevelocityAccessCredentials.parse('host1=a=b==;host2=c=d');

        expect(develocityAccessCredentials).toStrictEqual(DevelocityAccessCredentials.of([
            {hostname: 'host1', key: 'a=b=='},
            {hostname: 'host2', key: 'c=d'}])
        )
    })

    it('parse access key tolerates surrounding whitespace', async () => {
        let develocityAccessCredentials = DevelocityAccessCredentials.parse(' host1=key1\n');

        expect(develocityAccessCredentials).toStrictEqual(DevelocityAccessCredentials.of([
            {hostname: 'host1', key: 'key1'}])
        )
    })

    it.each([
        ['no separator', 'host1'],
        ['a trailing separator', 'host1=key1;'],
        ['a leading separator', ';host1=key1'],
        ['an empty hostname', '=key1'],
        ['an empty key', 'host1='],
        ['whitespace in the hostname', 'ho st1=key1'],
        ['whitespace in the key', 'host1=ke y1'],
        ['whitespace around a separator', 'host1=key1; host2=key2'],
        ['one invalid entry', 'host1=key1;random'],
    ])('parse access key with %s should return null', async (_description, rawKey) => {
        expect(DevelocityAccessCredentials.parse(rawKey)).toBeNull()
    })

    it('access key with an OIDC token value as raw string', async () => {
        const rawKey = 'host1=eyJhbGciOiJSUzI1NiJ9.payload.signature==;host2=key2'
        let develocityAccessCredentials = DevelocityAccessCredentials.parse(rawKey);

        expect(develocityAccessCredentials?.raw()).toBe(rawKey)
    })

    it('parse empty access key should return null', async () => {
        let develocityAccessCredentials = DevelocityAccessCredentials.parse('');

        expect(develocityAccessCredentials).toBeNull()
    })

    it('access key as raw string', async () => {
        let develocityAccessCredentials = DevelocityAccessCredentials.parse('host1=key1;host2=key2');

        expect(develocityAccessCredentials?.raw()).toBe('host1=key1;host2=key2')
    })

    it('get short lived token returns null when access key is empty', async () => {
        expect.assertions(1)
        await expect(getToken('', false, ''))
            .resolves
            .toBeNull()
    })

    it('get short lived token succeeds when single key is set', async () => {
        nock('https://dev')
            .post('/api/auth/token')
            .reply(200, 'token')
        expect.assertions(1)
        await expect(getToken('dev=key1', false, ''))
            .resolves
            .toEqual({"keys": [{"hostname": "dev", "key": "token"}]})
    })

    it('get short lived token succeeds when multiple keys are set', async () => {
        nock('https://dev')
            .post('/api/auth/token')
            .reply(200, 'token1')
        nock('https://prod')
            .post('/api/auth/token')
            .reply(200, 'token2')
        expect.assertions(1)
        await expect(getToken('dev=key1;prod=key2', false, ''))
            .resolves
            .toEqual({"keys": [{"hostname": "dev", "key": "token1"}, {"hostname": "prod", "key": "token2"}]})
    })

    it('get short lived token succeeds when multiple keys are set and one is failing', async () => {
        nock('https://dev')
            .post('/api/auth/token')
            .reply(200, 'token1')
        nock('https://bogus')
            .post('/api/auth/token')
            .times(3)
            .reply(500, 'Internal Error')
        nock('https://prod')
            .post('/api/auth/token')
            .reply(200, 'token2')
        expect.assertions(1)
        await expect(getToken('dev=key1;bogus=key0;prod=key2', false, ''))
            .resolves
            .toEqual({"keys": [{"hostname": "dev", "key": "token1"}, {"hostname": "prod", "key": "token2"}]})
    })

    it('get short lived token is null when multiple keys are set and all are failing', async () => {
        nock('https://dev')
            .post('/api/auth/token')
            .times(3)
            .reply(500, 'Internal Error')
        nock('https://bogus')
            .post('/api/auth/token')
            .times(3)
            .reply(500, 'Internal Error')
        expect.assertions(1)
        await expect(getToken('dev=key1;bogus=key0', false, ''))
            .resolves
            .toBeNull()
    })

    it('get short lived token with custom expiry', async () => {
        nock('https://dev')
            .post('/api/auth/token?expiresInHours=4')
            .reply(200, 'token')
        expect.assertions(1)
        await expect(getToken('dev=key1', false, '4'))
            .resolves
            .toEqual({"keys": [{"hostname": "dev", "key": "token"}]})
    })
})

describe('short lived tokens with retry', () => {
    afterEach(() => {
        nock.cleanAll()
        nock.restore()
    })

    it('get short lived token fails when cannot connect', async () => {
        nock('http://localhost:3333')
            .post('/api/auth/token')
            .times(3)
            .replyWithError({
                message: 'connect ECONNREFUSED 127.0.0.1:3333',
                code: 'ECONNREFUSED'
            })
        await expect(getToken('localhost=key0', false, ''))
            .resolves
            .toBeNull()
    })

    it('get short lived token is null when request fails', async () => {
        nock('http://dev:3333')
            .post('/api/auth/token')
            .times(3)
            .reply(500, 'Internal error')
        expect.assertions(1)
        await expect(getToken('dev=xyz', false, ''))
            .resolves
            .toBeNull()
    })
})

describe('resolveTokenForServer', () => {
    const credentials = (...pairs: [string, string][]): DevelocityAccessCredentials =>
        DevelocityAccessCredentials.of(pairs.map(([hostname, key]) => ({hostname, key})))

    it('returns the token matching the server host from a full URL', () => {
        const tokens = credentials(['ge.example.com', 'key1'], ['other', 'key2'])
        expect(resolveTokenForServer(tokens, 'https://ge.example.com')).toBe('key1')
    })

    it('matches on hostname, ignoring scheme, port and path', () => {
        const tokens = credentials(['ge.example.com', 'key1'])
        expect(resolveTokenForServer(tokens, 'https://ge.example.com:8443/path')).toBe('key1')
    })

    it('tolerates a bare hostname with no scheme', () => {
        const tokens = credentials(['ge.example.com', 'key1'])
        expect(resolveTokenForServer(tokens, 'ge.example.com')).toBe('key1')
    })

    it('selects the matching token when multiple are present', () => {
        const tokens = credentials(['dev', 'key1'], ['ge.example.com', 'key2'])
        expect(resolveTokenForServer(tokens, 'https://ge.example.com')).toBe('key2')
    })

    it('returns undefined when no token matches the server host', () => {
        const tokens = credentials(['ge.example.com', 'key1'])
        expect(resolveTokenForServer(tokens, 'https://other.example.com')).toBeUndefined()
    })

    it('returns undefined for an empty server URL', () => {
        const tokens = credentials(['ge.example.com', 'key1'])
        expect(resolveTokenForServer(tokens, '')).toBeUndefined()
    })

    it('returns undefined when there are no tokens', () => {
        expect(resolveTokenForServer(credentials(), 'https://ge.example.com')).toBeUndefined()
    })
})
