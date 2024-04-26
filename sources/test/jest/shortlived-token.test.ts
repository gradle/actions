import {DevelocityAccessCredentials, getToken} from "../../src/shortlived-token/shortlived-token";
import nock from "nock";

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

    it('get short lived token fails when cannot connect', async () => {
        nock('http://localhost:3333')
            .post('/api/auth/token')
            .times(3)
            .replyWithError({
                message: 'connect ECONNREFUSED 127.0.0.1:3333',
                code: 'ECONNREFUSED'
            })
        try {
            await getToken('true', 'http://localhost:3333', 'localhost=xyz;host1=key1', '')
            expect('should have thrown').toBeUndefined()
        } catch (e) {
            // @ts-ignore
            expect(e.code).toBe('ECONNREFUSED')
        }
    })

    it('get short lived token fails when request fails', async () => {
        nock('http://dev:3333')
            .post('/api/auth/token')
            .times(3)
            .reply(500, 'Internal error')
        expect.assertions(1)
        await expect(getToken('true', 'http://dev:3333', 'dev=xyz;host1=key1', ''))
            .rejects
            .toThrow('Develocity short lived token request failed http://dev:3333 with status code 500')
    })

    it('get short lived token fails when server url is not set', async () => {
        expect.assertions(1)
        await expect(getToken('true', undefined, 'localhost=xyz;host1=key1', ''))
            .rejects
            .toThrow('Develocity Server URL not configured')
    })

    it('get short lived token returns null when access key is empty', async () => {
        expect.assertions(1)
        await expect(getToken('true', 'http://dev:3333', '', ''))
            .resolves
            .toBeNull()
    })

    it('get short lived token fails when host cannot be extracted from server url', async () => {
        expect.assertions(1)
        await expect(getToken('true', 'not_a_url', 'localhost=xyz;host1=key1', ''))
            .rejects
            .toThrow('Could not extract hostname from Develocity server URL')
    })

    it('get short lived token fails when access key does not contain corresponding host', async () => {
        expect.assertions(1)
        await expect(getToken('true', 'http://dev', 'host1=xyz;host2=key2', ''))
            .rejects
            .toThrow('Could not find corresponding key for hostname dev')
    })

    it('get short lived token succeeds when enforce url is true', async () => {
        nock('https://dev')
            .post('/api/auth/token')
            .reply(200, 'token')
        expect.assertions(1)
        await expect(getToken('true', 'https://dev', 'dev=key1;host1=key2', ''))
            .resolves
            .toEqual({"keys": [{"hostname": "dev", "key": "token"}]})
    })

    it('get short lived token succeeds when enforce url is false and single key is set', async () => {
        nock('https://dev')
            .post('/api/auth/token')
            .reply(200, 'token')
        expect.assertions(1)
        await expect(getToken('false', 'https://dev', 'dev=key1', ''))
            .resolves
            .toEqual({"keys": [{"hostname": "dev", "key": "token"}]})
    })

    it('get short lived token succeeds when enforce url is false and multiple keys are set', async () => {
        nock('https://dev')
            .post('/api/auth/token')
            .reply(200, 'token1')
        nock('https://prod')
            .post('/api/auth/token')
            .reply(200, 'token2')
        expect.assertions(1)
        await expect(getToken('false', 'https://dev', 'dev=key1;prod=key2', ''))
            .resolves
            .toEqual({"keys": [{"hostname": "dev", "key": "token1"}, {"hostname": "prod", "key": "token2"}]})
    })

    it('get short lived token succeeds when enforce url is false and multiple keys are set and one is failing', async () => {
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
        await expect(getToken('false', 'https://dev', 'dev=key1;bogus=key0;prod=key2', ''))
            .resolves
            .toEqual({"keys": [{"hostname": "dev", "key": "token1"}, {"hostname": "prod", "key": "token2"}]})
    })
})
