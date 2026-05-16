# python-agent template

Baseline Python agent template for autonomous developer infrastructure.

## Contract
- Emits `replay-ledger.json` conforming to `schemas/replay-ledger.schema.json`.
- Emits `telemetry.json` and `execution-graph.json`.
- Can optionally emit to Orion (`POST /runs`).

## Role mapping
- `forge`: code generation and refactoring.
- `gate`: PR validation checks.
- `oracle`: summarization and analysis.
