import nock from "nock";
import {describe, expect, it} from '@jest/globals'

import {DevelocityAccessCredentials, getToken, resolveAccessKeyForServer} from "../../src/develocity/short-lived-token";

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

describe('resolveAccessKeyForServer', () => {
    it('returns the key matching the server host from a full URL', () => {
        expect(resolveAccessKeyForServer('ge.example.com=key1;other=key2', 'https://ge.example.com')).toBe('key1')
    })

    it('matches on hostname, ignoring scheme, port and path', () => {
        expect(resolveAccessKeyForServer('ge.example.com=key1', 'https://ge.example.com:8443/path')).toBe('key1')
    })

    it('tolerates a bare hostname with no scheme', () => {
        expect(resolveAccessKeyForServer('ge.example.com=key1', 'ge.example.com')).toBe('key1')
    })

    it('selects the matching key when multiple are present', () => {
        expect(resolveAccessKeyForServer('dev=key1;ge.example.com=key2', 'https://ge.example.com')).toBe('key2')
    })

    it('accepts a short-lived token value (JWT with dots and dashes)', () => {
        const token = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4In0.sig-na_ture'
        expect(resolveAccessKeyForServer(`ge.example.com=${token}`, 'https://ge.example.com')).toBe(token)
    })

    it('returns undefined when no key matches the server host', () => {
        expect(resolveAccessKeyForServer('ge.example.com=key1', 'https://other.example.com')).toBeUndefined()
    })

    it('returns undefined for an empty server URL', () => {
        expect(resolveAccessKeyForServer('ge.example.com=key1', '')).toBeUndefined()
    })

    it('returns undefined for an empty access key', () => {
        expect(resolveAccessKeyForServer('', 'https://ge.example.com')).toBeUndefined()
    })

    it('returns undefined for a malformed access key', () => {
        expect(resolveAccessKeyForServer('not-a-valid-access-key', 'https://ge.example.com')).toBeUndefined()
    })
})
