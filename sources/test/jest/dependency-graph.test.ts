import {describe, expect, it} from '@jest/globals'

import {DependencyGraphConfig} from "../../src/configuration" 
import {toSnapshotRequest} from "../../src/dependency-graph"

describe('dependency-graph', () => {
    describe('constructs job correlator', () => {
        it('removes commas from workflow name', () => {
            const id = DependencyGraphConfig.constructJobCorrelator('Workflow, with,commas', 'jobid', '{}')
            expect(id).toBe('workflow_withcommas-jobid')
        })
        it('removes non word characters', () => {
            const id = DependencyGraphConfig.constructJobCorrelator('Workflow!_with()characters', 'job-*id', '{"foo": "bar!@#$%^&*("}')
            expect(id).toBe('workflow_withcharacters-job-id-bar')
        })
        it('replaces spaces', () => {
            const id = DependencyGraphConfig.constructJobCorrelator('Workflow !_ with () characters, and   spaces', 'job-*id', '{"foo": "bar!@#$%^&*("}')
            expect(id).toBe('workflow___with_characters_and_spaces-job-id-bar')
        })
        it('without matrix', () => {
            const id = DependencyGraphConfig.constructJobCorrelator('workflow', 'jobid', 'null')
            expect(id).toBe('workflow-jobid')
        })
        it('with dashes in values', () => {
            const id = DependencyGraphConfig.constructJobCorrelator('workflow-name', 'job-id', '{"os": "ubuntu-latest"}')
            expect(id).toBe('workflow-name-job-id-ubuntu-latest')
        })
        it('with single matrix value', () => {
            const id = DependencyGraphConfig.constructJobCorrelator('workflow', 'jobid', '{"os": "windows"}')
            expect(id).toBe('workflow-jobid-windows')
        })
        it('with composite matrix value', () => {
            const id = DependencyGraphConfig.constructJobCorrelator('workflow', 'jobid', '{"os": "windows", "java-version": "21.1", "other": "Value, with COMMA"}')
            expect(id).toBe('workflow-jobid-windows-211-value_with_comma')
        })
    })
    describe('constructs snapshot request', () => {
        it('copies snapshot fields and sets owner and repo', () => {
            const snapshot = {version: 0, job: {correlator: 'c', id: '1'}, sha: 'abc', ref: 'refs/heads/main', detector: {name: 'd'}, scanned: '2026-10-27T00:00:00Z', manifests: {}}
            expect(toSnapshotRequest(snapshot, 'owner', 'repo')).toEqual({owner: 'owner', repo: 'repo', ...snapshot})
        })
        it('drops request options supplied by the file', () => {
            const request = toSnapshotRequest({version: 0, url: 'https://attacker.example', baseUrl: 'https://attacker.example', headers: {}, method: 'GET', request: {}, owner: 'other', repo: 'other'}, 'owner', 'repo')
            expect(request).toEqual({owner: 'owner', repo: 'repo', version: 0})
        })
    })
})
