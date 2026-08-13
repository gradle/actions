import {describe, expect, it} from '@jest/globals'

import * as inputParams from '../../src/configuration'

describe('input params', () => {
    describe('parses numeric input', () => {
        it('uses default value', () => {
            const val = inputParams.parseNumericInput('param-name', '', 88)
            expect(val).toBe(88)
        })
        it('parses numeric input', () => {
            const val = inputParams.parseNumericInput('param-name', '34', 88)
            expect(val).toBe(34)
        })
        it('fails on non-numeric input', () => {
            const t = () => {
                inputParams.parseNumericInput('param-name', 'xyz', 88)
            };

            expect(t).toThrow(TypeError)
            expect(t).toThrow("The value 'xyz' is not a valid numeric value for 'param-name'.")
        })
    })
})

describe('CacheConfig.getExternalCacheProvider', () => {
    const ENV_VAR = 'GRADLE_ACTIONS_EXTERNAL_CACHE_PROVIDER'
    const original = process.env[ENV_VAR]

    afterEach(() => {
        if (original === undefined) {
            delete process.env[ENV_VAR]
        } else {
            process.env[ENV_VAR] = original
        }
    })

    function provider(): string | undefined {
        return new inputParams.CacheConfig().getExternalCacheProvider()
    }

    it('returns undefined when the env var is unset', () => {
        delete process.env[ENV_VAR]
        expect(provider()).toBeUndefined()
    })

    it('returns undefined when the env var is empty or whitespace', () => {
        process.env[ENV_VAR] = '   '
        expect(provider()).toBeUndefined()
    })

    it('returns the provider label when set', () => {
        process.env[ENV_VAR] = 'Develocity Artifact Cache'
        expect(provider()).toBe('Develocity Artifact Cache')
    })

    it('sanitizes HTML-sensitive characters, newlines, and collapses whitespace', () => {
        process.env[ENV_VAR] = '  <b>Develocity`</b>\n Artifact   Cache  '
        expect(provider()).toBe('bDevelocity/b Artifact Cache')
    })

    it('caps the label length', () => {
        process.env[ENV_VAR] = 'x'.repeat(200)
        expect(provider()).toHaveLength(60)
    })
})
