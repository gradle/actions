import {afterEach, describe, expect, it} from '@jest/globals'

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

describe('CacheConfig.getExternalCacheHandler', () => {
    const ENV_VAR = 'GRADLE_ACTIONS_EXTERNAL_CACHE_PROVIDER'
    const original = process.env[ENV_VAR]

    afterEach(() => {
        if (original === undefined) {
            delete process.env[ENV_VAR]
        } else {
            process.env[ENV_VAR] = original
        }
    })

    function handler(): inputParams.ExternalCacheHandler | undefined {
        return new inputParams.CacheConfig().getExternalCacheHandler()
    }

    it('returns undefined when the env var is unset', () => {
        delete process.env[ENV_VAR]
        expect(handler()).toBeUndefined()
    })

    it('returns undefined when the env var is empty or whitespace', () => {
        process.env[ENV_VAR] = '   '
        expect(handler()).toBeUndefined()
    })

    it('returns the label when set', () => {
        process.env[ENV_VAR] = 'Develocity Artifact Cache'
        expect(handler()).toEqual({label: 'Develocity Artifact Cache'})
    })

    it('trims and collapses whitespace, including newlines', () => {
        process.env[ENV_VAR] = '  Develocity \n  Artifact  Cache  '
        expect(handler()).toEqual({label: 'Develocity Artifact Cache'})
    })

    it.each([
        ['HTML', '<b>Develocity</b>'],
        ['a markdown link', '[Develocity](https://example.com)'],
        ['markdown emphasis', '**Develocity**'],
        ['a table separator', 'Develocity | Artifact Cache'],
        ['a backtick', 'Develocity `Artifact` Cache'],
        ['an over-long label', 'x'.repeat(61)]
    ])('reports an unnamed handler rather than rendering %s', (_description, value) => {
        process.env[ENV_VAR] = value
        // Still a handler — the signal is honoured, only the label is dropped.
        expect(handler()).toEqual({})
    })

    it('accepts the punctuation commonly found in product names', () => {
        process.env[ENV_VAR] = 'Foo_Bar & Co. C++ cache-action'
        expect(handler()).toEqual({label: 'Foo_Bar & Co. C++ cache-action'})
    })
})
